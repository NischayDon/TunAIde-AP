"""tunAide AP — Audio Pusher API.

FastAPI backend acting as the tunAide API layer:
- JWT email/password authentication
- Audio upload endpoint (multipart) -> Emergent Object Storage
- Upload records + transcription jobs
NOTE: Transcription processing is SIMULATED (mock) — jobs move from
"processing" to "complete" after TRANSCRIBE_SIM_SECONDS. Swap the
transcription section with the real tunAide Transcribe API when available.
"""
import logging
import os
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv
from fastapi import (APIRouter, FastAPI, File, Form,
                     HTTPException, UploadFile, BackgroundTasks)
from fastapi.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("tunaide-api")

# ---------------------------------------------------------------- database
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ------------------------------------------------- Emergent Object Storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or \
    "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "tunaide-ap"
_storage_key: Optional[str] = None

MAX_UPLOAD_BYTES = 300 * 1024 * 1024  # 300 MB per file


def init_storage() -> str:
    """Idempotent storage init; returns reusable storage_key."""
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init",
                         json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload bytes to object storage. Retries once on stale key (503)."""
    global _storage_key
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120)
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120)
    if resp.status_code == 402:
        raise HTTPException(402, "Upload storage quota reached. Please try again later.")
    resp.raise_for_status()
    return resp.json()


# ----------------------------------------------------------------- helpers
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def publish_to_phase_one(upload_doc: dict):
    await db.uploads.update_one({"id": upload_doc["id"]}, {"$set": {"queue_status": "PUBLISHING"}})
    url = os.environ.get("PHASE_ONE_API_URL", "").rstrip("/") + "/api/internal/ingest/audio"
    token = os.environ.get("PHASE_ONE_INGEST_TOKEN", "")
    if not url or not token:
        logger.error("Phase One URL or token not configured.")
        await db.uploads.update_one({"id": upload_doc["id"]}, {"$set": {"queue_status": "PUBLISH_FAILED", "phase_one_error": "Not configured"}})
        return
    payload = {
        "source": "tunaide_ap",
        "source_upload_id": upload_doc["id"],
        "storage_provider": "emergent",
        "storage_key": upload_doc["storage_path"],
        "filename": upload_doc["file_name"],
        "file_size": upload_doc["size"],
        "mime_type": upload_doc["content_type"],
        "duration": upload_doc["duration"],
        "title": upload_doc["title"],
        "artist": upload_doc["artist"],
        "note": upload_doc["note"]
    }
    headers = {"Authorization": f"Bearer {token}"}
    max_retries = 3
    error_msg = ""
    for attempt in range(max_retries):
        try:
            resp = await run_in_threadpool(requests.post, url, json=payload, headers=headers, timeout=30)
            if resp.status_code in (200, 201):
                data = resp.json()
                await db.uploads.update_one({"id": upload_doc["id"]}, {"$set": {
                    "queue_status": "PUBLISHED",
                    "phase_one_queue_id": data.get("id"),
                    "phase_one_published_at": now_iso()
                }})
                logger.info(f"Published upload {upload_doc['id']} to Phase One")
                return
            else:
                logger.warning(f"Failed to publish to Phase One (status {resp.status_code}): {resp.text}")
                error_msg = f"HTTP {resp.status_code}"
        except Exception as e:
            logger.warning(f"Error publishing to Phase One: {e}")
            error_msg = str(e)
        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)
    await db.uploads.update_one({"id": upload_doc["id"]}, {"$set": {
        "queue_status": "PUBLISH_FAILED",
        "phase_one_error": error_msg
    }})
    logger.error(f"Permanently failed to publish upload {upload_doc['id']}")


# --------------------------------------------------------------------- app
app = FastAPI(title="tunAide AP API")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"service": "tunAide AP API", "status": "ok"}


@api.get("/health")
async def health_check():
    return {"status": "ok"}


# -------------------------------------------------------------- upload API
@api.post("/uploads", status_code=201)
async def create_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    file_name: str = Form(...),
    title: str = Form(""),
    artist: str = Form(""),
    note: str = Form(""),
    quality: str = Form("original"),
    priority: str = Form("normal"),
    duration: str = Form("0"),
):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Uploaded file is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds the 300 MB upload limit")

    try:
        duration_sec = float(duration)
    except ValueError:
        duration_sec = 0.0

    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "bin"
    content_type = file.content_type or "application/octet-stream"
    storage_path = f"{APP_NAME}/uploads/{uuid.uuid4().hex}.{ext}"

    try:
        stored = await run_in_threadpool(put_object, storage_path, data, content_type)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("Object storage upload failed: %s", exc)
        raise HTTPException(502, "Upload storage is unavailable right now. Please retry.")

    # Duplicate awareness: same name + byte size (files stay separate)
    dup = await db.uploads.find_one(
        {"file_name": file_name, "size": len(data)},
        {"_id": 0, "id": 1})

    upload_doc = {
        "id": str(uuid.uuid4()),
        "file_name": file_name,
        "title": title,
        "artist": artist,
        "note": note,
        "quality": quality,
        "priority": priority,
        "duration": duration_sec,
        "size": len(data),
        "content_type": content_type,
        "storage_path": stored.get("path", storage_path),
        "status": "complete",
        "is_duplicate": bool(dup),
        "created_at": now_iso(),
        "completed_at": now_iso(),
        "queue_status": "UPLOADED",
        "phase_one_queue_id": None,
        "phase_one_published_at": None,
        "phase_one_error": None,
    }
    await db.uploads.insert_one(upload_doc)

    background_tasks.add_task(publish_to_phase_one, upload_doc)

    return {
        "upload": {k: v for k, v in upload_doc.items()
                   if k not in ("user_id", "storage_path", "_id")}
    }


@api.get("/uploads")
async def list_uploads():
    docs = await db.uploads.find(
        {},
        {"_id": 0, "user_id": 0, "storage_path": 0},
    ).sort("created_at", -1).to_list(300)
    return docs


@api.post("/uploads/{upload_id}/retry_publish", status_code=202)
async def retry_publish(upload_id: str, background_tasks: BackgroundTasks):
    upload_doc = await db.uploads.find_one({"id": upload_id})
    if not upload_doc:
        raise HTTPException(404, "Upload not found")
    if upload_doc.get("queue_status") == "PUBLISHED":
        raise HTTPException(400, "Upload is already published")
    background_tasks.add_task(publish_to_phase_one, upload_doc)
    return {"message": "Retry initiated"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage initialised")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Object storage init failed (will retry on upload): %s", exc)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
