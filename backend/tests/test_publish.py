import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os

# Add backend to sys.path to import server
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock environment variables required by server.py at import time
os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "test_db"
os.environ["S3_ENDPOINT_URL"] = "http://localhost:9000"
os.environ["S3_ACCESS_KEY_ID"] = "minioadmin"
os.environ["S3_SECRET_ACCESS_KEY"] = "minioadmin"
os.environ["S3_BUCKET_NAME"] = "test-bucket"

from server import publish_to_phase_one, db
import requests

@pytest.fixture
def mock_db_update():
    with patch.object(db.uploads, 'update_one', new_callable=AsyncMock) as mock_update:
        yield mock_update

@pytest.fixture
def mock_requests_post():
    with patch('server.requests.post') as mock_post:
        yield mock_post

@pytest.fixture
def base_upload_doc():
    return {
        "id": "test_id_123",
        "file_name": "test.wav",
        "size": 1000,
        "content_type": "audio/wav",
        "storage_path": "path/to/test.wav",
        "duration": 1109.983,
        "title": "Test Title",
        "artist": "Test Artist",
        "note": "Test Note"
    }

@pytest.fixture(autouse=True)
def setup_env():
    os.environ["PHASE_ONE_API_URL"] = "http://test-phase-one"
    os.environ["PHASE_ONE_INGEST_TOKEN"] = "test-token"
    yield
    del os.environ["PHASE_ONE_API_URL"]
    del os.environ["PHASE_ONE_INGEST_TOKEN"]

@pytest.mark.asyncio
async def test_duration_normalization(mock_db_update, mock_requests_post, base_upload_doc):
    # 1109.983 -> 1110
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"queue_item_id": 42}
    mock_requests_post.return_value = mock_resp

    await publish_to_phase_one(base_upload_doc)

    assert mock_requests_post.called
    kwargs = mock_requests_post.call_args.kwargs
    assert kwargs["json"]["duration"] == 1110
    
    # 1109.4 -> 1109
    base_upload_doc["duration"] = 1109.4
    await publish_to_phase_one(base_upload_doc)
    kwargs = mock_requests_post.call_args.kwargs
    assert kwargs["json"]["duration"] == 1109

    # None -> None
    base_upload_doc["duration"] = None
    await publish_to_phase_one(base_upload_doc)
    kwargs = mock_requests_post.call_args.kwargs
    assert kwargs["json"]["duration"] is None

@pytest.mark.asyncio
async def test_successful_response(mock_db_update, mock_requests_post, base_upload_doc):
    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_resp.json.return_value = {"success": True, "queue_item_id": 123}
    mock_requests_post.return_value = mock_resp

    await publish_to_phase_one(base_upload_doc)

    assert mock_requests_post.call_count == 1
    mock_db_update.assert_any_call(
        {"id": "test_id_123"},
        {"$set": {"queue_status": "PUBLISHING"}}
    )
    # Check that PUBLISHED status was set
    last_call = mock_db_update.call_args_list[-1]
    assert last_call.args[0] == {"id": "test_id_123"}
    assert last_call.args[1]["$set"]["queue_status"] == "PUBLISHED"
    assert last_call.args[1]["$set"]["phase_one_queue_id"] == 123

@pytest.mark.asyncio
async def test_duplicate_response(mock_db_update, mock_requests_post, base_upload_doc):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    # Duplicate returns a queue ID too usually or same success but duplicate flag
    mock_resp.json.return_value = {"success": True, "duplicate": True, "queue_item_id": 123}
    mock_requests_post.return_value = mock_resp

    await publish_to_phase_one(base_upload_doc)

    assert mock_requests_post.call_count == 1
    last_call = mock_db_update.call_args_list[-1]
    assert last_call.args[1]["$set"]["queue_status"] == "PUBLISHED"
    assert last_call.args[1]["$set"]["phase_one_queue_id"] == 123

@pytest.mark.asyncio
async def test_422_no_retry(mock_db_update, mock_requests_post, base_upload_doc):
    mock_resp = MagicMock()
    mock_resp.status_code = 422
    mock_resp.text = "Validation Error"
    mock_requests_post.return_value = mock_resp

    await publish_to_phase_one(base_upload_doc)

    # Should only call once, no retries
    assert mock_requests_post.call_count == 1
    
    last_call = mock_db_update.call_args_list[-1]
    assert last_call.args[1]["$set"]["queue_status"] == "PUBLISH_FAILED"
    assert "422" in last_call.args[1]["$set"]["phase_one_error"]

@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [400, 401, 403, 404])
async def test_4xx_no_retry(mock_db_update, mock_requests_post, base_upload_doc, status_code):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.text = "Error"
    mock_requests_post.return_value = mock_resp

    await publish_to_phase_one(base_upload_doc)

    assert mock_requests_post.call_count == 1
    last_call = mock_db_update.call_args_list[-1]
    assert last_call.args[1]["$set"]["queue_status"] == "PUBLISH_FAILED"
    assert str(status_code) in last_call.args[1]["$set"]["phase_one_error"]

@pytest.mark.asyncio
async def test_500_retry(mock_db_update, mock_requests_post, base_upload_doc):
    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "Internal Server Error"
    mock_requests_post.return_value = mock_resp

    with patch("server.asyncio.sleep", new_callable=AsyncMock):
        await publish_to_phase_one(base_upload_doc)

    # Should retry 3 times
    assert mock_requests_post.call_count == 3
    last_call = mock_db_update.call_args_list[-1]
    assert last_call.args[1]["$set"]["queue_status"] == "PUBLISH_FAILED"

@pytest.mark.asyncio
async def test_timeout_retry(mock_db_update, mock_requests_post, base_upload_doc):
    mock_requests_post.side_effect = requests.exceptions.Timeout("Connection timed out")

    with patch("server.asyncio.sleep", new_callable=AsyncMock):
        await publish_to_phase_one(base_upload_doc)

    # Should retry 3 times
    assert mock_requests_post.call_count == 3
    last_call = mock_db_update.call_args_list[-1]
    assert last_call.args[1]["$set"]["queue_status"] == "PUBLISH_FAILED"
    assert "Timeout" in last_call.args[1]["$set"]["phase_one_error"]

@pytest.mark.asyncio
async def test_idempotency_skip(mock_db_update, mock_requests_post, base_upload_doc):
    base_upload_doc["phase_one_queue_id"] = 123
    
    await publish_to_phase_one(base_upload_doc)

    assert mock_requests_post.call_count == 0
    assert mock_db_update.call_count == 0
