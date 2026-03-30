import pytest
from fastapi.testclient import TestClient
from main import app
import database
import models
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use in-memory SQLite for testing to protect actual PG instance
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[database.get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    models.Base.metadata.create_all(bind=engine)
    yield
    models.Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_real_eml_parser():
    import parsers
    import os
    
    # Path to the downloaded test file
    sample_path = os.path.join(os.path.dirname(__file__), "test_data", "sample-100.eml")
    if not os.path.exists(sample_path):
        pytest.skip("Test sample not downloaded")
        
    with open(sample_path, "rb") as f:
        content = f.read()
        
    result = parsers.parse_eml(content)
    
    assert result["message_id"] != ""
    assert isinstance(result["indicators"], list)
    # The sample should contain at least one extracted indicator (URL or IP)
    assert len(result["indicators"]) > 0
    
def test_ingest_duplicate_emails():
    # Submit first time using real parse engine
    import os
    sample_path = os.path.join(os.path.dirname(__file__), "test_data", "sample-100.eml")
    if not os.path.exists(sample_path):
        pytest.skip("Test sample not downloaded")
        
    with open(sample_path, "rb") as f:
        file_bytes = f.read()

    files = {'file': ('sample-100.eml', file_bytes, 'message/rfc822')}
    response1 = client.post("/api/ingest", files=files)
    assert response1.status_code == 200
    assert response1.json()["status"] == "success"
    
    # Submit second time (duplicate)
    files2 = {'file': ('sample-100.eml', file_bytes, 'message/rfc822')}
    response2 = client.post("/api/ingest", files=files2)
    assert response2.status_code == 200
    assert response2.json()["status"] == "duplicate"

def test_verdict_workflow():
    # Insert a dummy indicator
    db = TestingSessionLocal()
    sub = models.EmailSubmission(message_id="test1@test")
    db.add(sub)
    db.commit()
    db.refresh(sub)
    
    ind = models.Indicator(submission_id=sub.id, indicator_type="URL", value="http://phish.com", status="PENDING")
    db.add(ind)
    db.commit()
    db.refresh(ind)
    
    # Verify in queue
    resp = client.get("/api/queue")
    assert resp.status_code == 200
    assert len(resp.json()["queue"]) == 1
    
    # Approve it
    resp = client.post(f"/api/verdict/{ind.id}?status=APPROVED")
    assert resp.status_code == 200
    
    # Verify not in queue anymore
    resp = client.get("/api/queue")
    assert len(resp.json()["queue"]) == 0
    
    # Verify in EDL
    resp = client.get("/api/feeds/edl")
    assert resp.status_code == 200
    assert "http://phish.com" in resp.text
