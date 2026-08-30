"""tunAide AP — Audio Pusher API.

FastAPI backend acting as the tunAide API layer:
- JWT email/password authentication
- Audio upload endpoint (multipart) -> S3 Object Storage
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
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR.parent / '.env')

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("tunaide-api")

# ---------------------------------------------------------------- database
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ------------------------------------------------- Railway S3 Object Storage
import boto3
from botocore.exceptions import ClientError

S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL")
S3_ACCESS_KEY_ID = os.environ.get("S3_ACCESS_KEY_ID")
S3_SECRET_ACCESS_KEY = os.environ.get("S3_SECRET_ACCESS_KEY")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")
S3_REGION_NAME = os.environ.get("S3_REGION_NAME", "us-east-1")
APP_NAME = "tunaide-ap"

MAX_UPLOAD_BYTES = 300 * 1024 * 1024  # 300 MB per file

def get_s3_client():
    if not all([S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME]):
        raise RuntimeError("S3 configuration is missing. Ensure S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET_NAME are set.")
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        region_name=S3_REGION_NAME
    )

def put_object(path: str, file_obj, content_type: str) -> dict:
    """Upload file-like object to Railway S3 object storage safely without loading entire file into RAM."""
    s3 = get_s3_client()
    try:
        s3.upload_fileobj(
            file_obj,
            S3_BUCKET_NAME,
            path,
            ExtraArgs={'ContentType': content_type}
        )
        return {"path": path}
    except ClientError as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(502, "Upload storage is unavailable right now. Please retry.")


# ----------------------------------------------------------------- helpers
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

class PhaseOneIngestPayload(BaseModel):
    source: str
    source_upload_id: str
    storage_key: str
    filename: str
    file_size: int
    mime_type: Optional[str] = None
    duration: Optional[int] = None
    title: Optional[str] = None
    artist: Optional[str] = None
    note: Optional[str] = None

async def publish_to_phase_one(upload_doc: dict):
    if upload_doc.get("phase_one_queue_id") is not None:
        logger.info(f"Upload {upload_doc['id']} already published to Phase One (queue ID: {upload_doc['phase_one_queue_id']}). Skipping.")
        return

    await db.uploads.update_one({"id": upload_doc["id"]}, {"$set": {"queue_status": "PUBLISHING"}})
    url = os.environ.get("PHASE_ONE_API_URL", "").rstrip("/") + "/api/internal/ingest/audio"
    token = os.environ.get("PHASE_ONE_INGEST_TOKEN", "")
    if not url or not token:
        logger.error("Phase One URL or token not configured.")
        await db.uploads.update_one({"id": upload_doc["id"]}, {"$set": {"queue_status": "PUBLISH_FAILED", "phase_one_error": "Not configured"}})
        return

    duration = upload_doc.get("duration")
    normalized_duration = int(round(duration)) if duration is not None else None

    try:
        payload = PhaseOneIngestPayload(
            source="tunaide_ap",
            source_upload_id=upload_doc["id"],
            storage_key=upload_doc.get("storage_path", ""),
            filename=upload_doc.get("file_name", ""),
            file_size=upload_doc.get("size", 0),
            mime_type=upload_doc.get("content_type"),
            duration=normalized_duration,
            title=upload_doc.get("title"),
            artist=upload_doc.get("artist"),
            note=upload_doc.get("note")
        )
    except Exception as e:
        logger.error(f"Failed to construct Phase One payload for upload {upload_doc['id']}: {e}")
        await db.uploads.update_one({"id": upload_doc["id"]}, {"$set": {"queue_status": "PUBLISH_FAILED", "phase_one_error": "Payload validation error"}})
        return

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    max_retries = 3
    error_msg = ""
    for attempt in range(max_retries):
        try:
            resp = await run_in_threadpool(
                requests.post, 
                url, 
                json=payload.model_dump() if hasattr(payload, "model_dump") else payload.dict(), 
                headers=headers, 
                timeout=(5, 30)
            )
            
            if resp.status_code in (200, 201):
                data = resp.json()
                queue_id = data.get("queue_item_id") or data.get("id")
                await db.uploads.update_one({"id": upload_doc["id"]}, {"$set": {
                    "queue_status": "PUBLISHED",
                    "phase_one_queue_id": queue_id,
                    "phase_one_published_at": now_iso()
                }})
                logger.info(f"Successfully published upload {upload_doc['id']} to Phase One queue item {queue_id}")
                return
            elif resp.status_code == 422:
                logger.warning(f"Phase One rejected upload {upload_doc['id']} with HTTP 422: {resp.text}")
                error_msg = f"HTTP 422: {resp.text}"
                break
            elif resp.status_code in (400, 401, 403, 404):
                logger.warning(f"Phase One rejected upload {upload_doc['id']} with HTTP {resp.status_code}: {resp.text}")
                error_msg = f"HTTP {resp.status_code}"
                break
            else:
                logger.warning(f"Temporary Phase One failure for upload {upload_doc['id']} (status {resp.status_code}): {resp.text}; retrying")
                error_msg = f"HTTP {resp.status_code}"
        except requests.exceptions.Timeout:
            logger.warning(f"Temporary Phase One failure for upload {upload_doc['id']}; retrying (Timeout)")
            error_msg = "Timeout"
        except requests.exceptions.ConnectionError:
            logger.warning(f"Temporary Phase One failure for upload {upload_doc['id']}; retrying (ConnectionError)")
            error_msg = "ConnectionError"
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
    if not getattr(file, "size", 1): # FastAPI UploadFile has size attribute
        raise HTTPException(400, "Uploaded file is empty")
    if getattr(file, "size", 0) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds the 300 MB upload limit")

    try:
        duration_sec = float(duration)
    except ValueError:
        duration_sec = 0.0

    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "bin"
    content_type = file.content_type or "application/octet-stream"
    storage_path = f"{APP_NAME}/uploads/{uuid.uuid4().hex}.{ext}"

    try:
        file.file.seek(0)
        stored = await run_in_threadpool(put_object, storage_path, file.file, content_type)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("Object storage upload failed: %s", exc)
        raise HTTPException(502, "Upload storage is unavailable right now. Please retry.")

    # Duplicate awareness: same name + size (files stay separate)
    dup = await db.uploads.find_one(
        {"file_name": file_name, "size": getattr(file, "size", 0)},
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
        "size": getattr(file, "size", 0),
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
    pass


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# -------------------------------------------------------------- Text Extraction (PDF + Image OCR)
import io
import PyPDF2

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".tif", ".webp")

@api.post("/extract-pdf")
async def extract_text(file: UploadFile = File(...)):
    """Extract text from PDF (digital text) or images (via Emergent LLM OCR)."""
    fname = (file.filename or "").lower()
    is_pdf = fname.endswith(".pdf")
    is_image = any(fname.endswith(ext) for ext in IMAGE_EXTS)

    if not is_pdf and not is_image:
        raise HTTPException(400, "File must be a PDF or an image (JPG, PNG, etc.)")

    try:
        content = await file.read()

        if is_pdf:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return {"text": text}

        # Image OCR via Emergent LLM (vision model)
        import base64
        emergent_key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not emergent_key:
            raise HTTPException(500, "OCR service not configured")

        img_b64 = base64.b64encode(content).decode("utf-8")
        mime = file.content_type or "image/jpeg"

        ocr_payload = {
            "model": "gemini-2.0-flash",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{img_b64}"}
                        },
                        {
                            "type": "text",
                            "text": "Extract ALL text from this image exactly as written. Return ONLY the extracted text, nothing else. Preserve paragraphs and line breaks."
                        }
                    ]
                }
            ],
            "max_tokens": 4096
        }
        headers = {
            "Authorization": f"Bearer {emergent_key}",
            "Content-Type": "application/json"
        }

        resp = await run_in_threadpool(
            requests.post,
            "https://api.emergentmind.com/v1/chat/completions",
            json=ocr_payload,
            headers=headers,
            timeout=(10, 60)
        )

        if resp.status_code != 200:
            logger.error(f"Emergent LLM OCR failed: {resp.status_code} {resp.text}")
            raise HTTPException(502, "OCR service returned an error")

        data = resp.json()
        extracted = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return {"text": extracted}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        raise HTTPException(500, "Failed to extract text from file")
