from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
import datetime

class EmailSubmission(Base):
    __tablename__ = "email_submissions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String, unique=True, index=True, nullable=False) # Important for idempotency
    subject = Column(String, nullable=True)
    sender = Column(String, nullable=True)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)

    indicators = relationship("Indicator", back_populates="submission")

class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("email_submissions.id"))
    indicator_type = Column(String) # e.g., 'URL', 'IP', 'HASH'
    value = Column(String, index=True)
    
    # Enrichment
    vt_score = Column(Integer, nullable=True) # VirusTotal score context
    enrichment_details = Column(JSON, nullable=True) # Detailed results from URLhaus, ThreatFox, VirusTotal
    
    # Workflow Status
    # PENDING, APPROVED (goes to fw), DENIED (false positive)
    status = Column(String, default="PENDING")

    submission = relationship("EmailSubmission", back_populates="indicators")

class FeedAccessLog(Base):
    __tablename__ = "feed_access_logs"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String) # e.g., 'url' or 'ip'
    ip_address = Column(String) # the firewall pulling the feed
    accessed_at = Column(DateTime, default=datetime.datetime.utcnow)

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
