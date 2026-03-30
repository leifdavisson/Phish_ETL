from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import database
import models
import enrichment
from datetime import datetime, timedelta
import os
import secrets

# Initialize the db tables 
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Phish_ETL API")

# Setup Authentication Secrets
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "supersecret")
ACTIVE_TOKEN = secrets.token_urlsafe(32)

def verify_admin(request: Request):
    """Dependency to lock down administrative API routes."""
    auth = request.headers.get("Authorization")
    if not auth or auth != f"Bearer {ACTIVE_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

@app.post("/api/login")
def login(data: dict):
    if data.get("password") == ADMIN_PASSWORD:
        return {"token": ACTIVE_TOKEN}
    raise HTTPException(status_code=401, detail="Invalid password")

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow()}

@app.post("/api/ingest")
async def ingest_email(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(None), 
    db: Session = Depends(database.get_db)
):
    """Ingests files, extracts IOCs, creates DB entries, and triggers ASGI OSINT tasks."""
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    filename = file.filename.lower()
    
    import parsers
    content = await file.read()
    try:
        parsed_data = parsers.parse_eml(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse email: {str(e)}")
    
    message_id = parsed_data["message_id"]

    # Prevent duplicate by Message-ID
    existing = db.query(models.EmailSubmission).filter(models.EmailSubmission.message_id == message_id).first()
    if existing:
        return {"status": "duplicate", "message": "Email already ingested", "id": existing.id}

    # Save to database
    submission = models.EmailSubmission(
        message_id=message_id,
        subject=parsed_data["subject"],
        sender=parsed_data["sender"]
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    for ind in parsed_data["indicators"]:
        new_ind = models.Indicator(
            submission_id=submission.id,
            indicator_type=ind["type"],
            value=ind["value"],
            status="PENDING"
        )
        db.add(new_ind)
    db.commit()
    
    # Asynchronous Enrichment Launch
    inds = db.query(models.Indicator).filter(models.Indicator.submission_id == submission.id).all()
    for ind in inds:
        background_tasks.add_task(enrichment.enrich_indicator, ind.id)
    
    return {"status": "success", "message": f"Ingested {filename}", "id": submission.id, "indicators": len(parsed_data["indicators"])}

@app.get("/api/queue", dependencies=[Depends(verify_admin)])
def get_review_queue(db: Session = Depends(database.get_db)):
    """Returns indicators waiting for approval."""
    from sqlalchemy.orm import joinedload
    indicators = db.query(models.Indicator).options(joinedload(models.Indicator.submission)).filter(models.Indicator.status == "PENDING").all()
    queue = []
    for ind in indicators:
        queue.append({
            "id": ind.id,
            "type": ind.indicator_type,
            "value": ind.value,
            "score": ind.vt_score,
            "status": ind.status,
            "sender": ind.submission.sender if ind.submission else "Unknown",
            "subject": ind.submission.subject if ind.submission else "Unknown",
            "submitted_at": ind.submission.submitted_at.isoformat() if ind.submission and ind.submission.submitted_at else datetime.utcnow().isoformat()
        })
    return {"queue": queue}

@app.get("/api/history", dependencies=[Depends(verify_admin)])
def get_history_queue(db: Session = Depends(database.get_db)):
    """Returns indicators that were APPROVED or DENIED."""
    from sqlalchemy.orm import joinedload
    indicators = db.query(models.Indicator).options(joinedload(models.Indicator.submission)).filter(models.Indicator.status.in_(["APPROVED", "DENIED"])).order_by(models.Indicator.id.desc()).all()
    history = []
    for ind in indicators:
        history.append({
            "id": ind.id,
            "type": ind.indicator_type,
            "value": ind.value,
            "score": ind.vt_score,
            "status": ind.status,
            "sender": ind.submission.sender if ind.submission else "Unknown",
            "subject": ind.submission.subject if ind.submission else "Unknown",
            "submitted_at": ind.submission.submitted_at.isoformat() if ind.submission and ind.submission.submitted_at else datetime.utcnow().isoformat()
        })
    return {"history": history}

@app.post("/api/verdict/{indicator_id}", dependencies=[Depends(verify_admin)])
def update_verdict(indicator_id: int, status: str, db: Session = Depends(database.get_db)):
    """Update verdict to APPROVED or DENIED."""
    ind = db.query(models.Indicator).filter(models.Indicator.id == indicator_id).first()
    if not ind:
        raise HTTPException(status_code=404, detail="Indicator not found")
    if status not in ["APPROVED", "DENIED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    ind.status = status
    db.commit()
    return {"status": "success", "new_status": ind.status}

@app.get("/api/feeds/edl/{feed_type}", response_class=PlainTextResponse)
def export_edl(feed_type: str, request: Request, db: Session = Depends(database.get_db)):
    """Exports deduplicated APPROVED indicators (ip or url) for firewall ingestion, mapped with TTL logs."""
    feed_type_upper = feed_type.upper()
    if feed_type_upper not in ["IP", "URL"]:
        raise HTTPException(status_code=400, detail="Feed type must be 'ip' or 'url'")

    # Firewall Auditing
    log = models.FeedAccessLog(endpoint=feed_type_upper, ip_address=request.client.host)
    db.add(log)
    db.commit()

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    indicators = (db.query(models.Indicator)
        .join(models.Indicator.submission)
        .filter(models.Indicator.status == "APPROVED")
        .filter(models.Indicator.indicator_type == feed_type_upper)
        .filter(models.EmailSubmission.submitted_at >= thirty_days_ago)
        .all())
    
    # Deduplicate arrays explicitly via set()
    edl_lines = list(set([ind.value for ind in indicators]))
    return "\n".join(edl_lines)

@app.delete("/api/indicator/{indicator_id}", dependencies=[Depends(verify_admin)])
def delete_indicator(indicator_id: int, db: Session = Depends(database.get_db)):
    """Permanently drops an indicator."""
    ind = db.query(models.Indicator).filter(models.Indicator.id == indicator_id).first()
    if not ind:
        raise HTTPException(status_code=404, detail="Indicator not found")
    db.delete(ind)
    db.commit()
    return {"status": "success"}

@app.delete("/api/clear", dependencies=[Depends(verify_admin)])
def clear_database(db: Session = Depends(database.get_db)):
    """DANGEROUS: Wipes entire testing database."""
    db.query(models.Indicator).delete()
    db.query(models.EmailSubmission).delete()
    db.commit()
    return {"status": "success"}

@app.get("/api/status", dependencies=[Depends(verify_admin)])
def system_status(db: Session = Depends(database.get_db)):
    """Backend operations health check dashboard API."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "Online"
    except:
        db_status = "Offline"
        
    return {
        "internal": {
            "postgres": db_status,
            "emails_parsed": db.query(models.EmailSubmission).count(),
            "indicators_tracked": db.query(models.Indicator).count()
        },
        "external": {
            "urlhaus_api": "Active Mapping",
            "threatfox_api": "Active Mapping",
            "virustotal_api": "Configured" if os.getenv("VT_API_KEY") else "Missing .env Key"
        }
    }

@app.get("/api/logs/edl", dependencies=[Depends(verify_admin)])
def get_edl_logs(db: Session = Depends(database.get_db)):
    """Returns the scrolling access logs for Palo Alto fetching blocks."""
    logs = db.query(models.FeedAccessLog).order_by(models.FeedAccessLog.id.desc()).limit(50).all()
    return [{"id": l.id, "endpoint": l.endpoint, "ip": l.ip_address, "time": l.accessed_at.isoformat()} for l in logs]
