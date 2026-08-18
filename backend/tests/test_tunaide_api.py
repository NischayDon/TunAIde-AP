"""tunAide AP backend tests — auth, uploads, transcriptions (simulated)."""
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


@pytest.fixture(scope="session")
def fresh_user(session):
    """Register a fresh user for isolation."""
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "TEST User", "email": email, "password": "Test123!"}
    r = session.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 201, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "password": "Test123!"}


@pytest.fixture(scope="session")
def seeded_user(session):
    """Ensure seeded user exists (test@tunaide.com / Test123!)."""
    email = "test@tunaide.com"
    r = session.post(f"{API}/auth/login", json={"email": email, "password": "Test123!"}, timeout=30)
    if r.status_code == 401:
        reg = session.post(f"{API}/auth/register",
                           json={"name": "Test User", "email": email, "password": "Test123!"},
                           timeout=30)
        assert reg.status_code in (201, 409), reg.text
        r = session.post(f"{API}/auth/login", json={"email": email, "password": "Test123!"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------- health
class TestHealth:
    def test_root_ok(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# --------------------------- auth
class TestAuth:
    def test_register_returns_token_and_user(self, fresh_user):
        assert fresh_user["token"]
        u = fresh_user["user"]
        assert "id" in u and "email" in u and "created_at" in u

    def test_register_duplicate_email_409(self, session, fresh_user):
        email = fresh_user["user"]["email"]
        r = session.post(f"{API}/auth/register",
                         json={"name": "Dup", "email": email, "password": "Test123!"}, timeout=15)
        assert r.status_code == 409, r.text

    def test_login_valid(self, session, fresh_user):
        r = session.post(f"{API}/auth/login",
                         json={"email": fresh_user["user"]["email"], "password": "Test123!"}, timeout=15)
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password_401(self, session, fresh_user):
        r = session.post(f"{API}/auth/login",
                         json={"email": fresh_user["user"]["email"], "password": "WRONG!!"}, timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, session, fresh_user):
        r = session.get(f"{API}/auth/me",
                        headers={"Authorization": f"Bearer {fresh_user['token']}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == fresh_user["user"]["email"]

    def test_me_no_token_401(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_bad_token_401(self, session):
        r = session.get(f"{API}/auth/me",
                        headers={"Authorization": "Bearer notavalidjwt"}, timeout=15)
        assert r.status_code == 401


# --------------------------- uploads
def _wav_bytes(duration_sec: float = 1.0, sr: int = 8000) -> bytes:
    """Tiny synthesized WAV so we don't hit real 300MB paths."""
    import struct
    n = int(sr * duration_sec)
    data = b"".join(struct.pack("<h", 0) for _ in range(n))
    header = (
        b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16)
        + b"data" + struct.pack("<I", len(data))
    )
    return header + data


class TestUploads:
    def test_upload_requires_auth(self, session):
        files = {"file": ("t.wav", io.BytesIO(_wav_bytes()), "audio/wav")}
        r = session.post(f"{API}/uploads",
                         files=files, data={"file_name": "t.wav"}, timeout=60)
        assert r.status_code == 401

    def test_upload_success_returns_upload_and_transcription_id(self, session, fresh_user):
        files = {"file": ("push_me.wav", io.BytesIO(_wav_bytes(1.5)), "audio/wav")}
        form = {
            "file_name": "push_me.wav",
            "title": "Push Me",
            "artist": "TEST",
            "note": "hello",
            "quality": "original",
            "priority": "high",
            "duration": "1.5",
        }
        r = session.post(f"{API}/uploads", files=files, data=form,
                         headers={"Authorization": f"Bearer {fresh_user['token']}"}, timeout=90)
        assert r.status_code == 201, r.text
        body = r.json()
        assert "upload" in body and "transcription_id" in body
        up = body["upload"]
        assert up["file_name"] == "push_me.wav"
        assert up["title"] == "Push Me"
        assert up["priority"] == "high"
        assert "storage_path" not in up  # scrubbed
        assert "user_id" not in up
        assert "_id" not in up

    def test_list_uploads_scrubbed(self, session, fresh_user):
        r = session.get(f"{API}/uploads",
                        headers={"Authorization": f"Bearer {fresh_user['token']}"}, timeout=30)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list) and len(docs) >= 1
        for d in docs:
            assert "_id" not in d
            assert "storage_path" not in d
            assert "user_id" not in d


# --------------------------- transcriptions
class TestTranscriptions:
    def test_list_transcriptions_scrubbed(self, session, fresh_user):
        r = session.get(f"{API}/transcriptions",
                        headers={"Authorization": f"Bearer {fresh_user['token']}"}, timeout=30)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list) and len(docs) >= 1
        for d in docs:
            assert "_id" not in d
            assert "user_id" not in d
            assert d["status"] in ("processing", "complete")

    @pytest.mark.slow
    def test_processing_flips_to_complete(self, session, fresh_user):
        """Upload with duration=0, poll for ~50s to see status flip."""
        files = {"file": ("flip.wav", io.BytesIO(_wav_bytes(0.5)), "audio/wav")}
        form = {"file_name": "flip.wav", "duration": "0"}
        up = session.post(f"{API}/uploads", files=files, data=form,
                          headers={"Authorization": f"Bearer {fresh_user['token']}"}, timeout=60)
        assert up.status_code == 201
        tid = up.json()["transcription_id"]

        deadline = time.time() + 60
        status = None
        while time.time() < deadline:
            r = session.get(f"{API}/transcriptions",
                            headers={"Authorization": f"Bearer {fresh_user['token']}"}, timeout=15)
            assert r.status_code == 200
            match = next((d for d in r.json() if d["id"] == tid), None)
            assert match is not None
            status = match["status"]
            if status == "complete":
                break
            time.sleep(5)
        assert status == "complete", f"Job did not flip to complete within 60s (last={status})"
