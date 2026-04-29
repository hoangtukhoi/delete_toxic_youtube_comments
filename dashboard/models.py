from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime
from dashboard.database import Base
from datetime import datetime

class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, index=True) # YouTube comment ID
    video_id = Column(String, index=True)
    author = Column(String)
    author_image = Column(String)
    text = Column(String)
    is_toxic = Column(Boolean)
    confidence = Column(Float) # 0 to 100
    published_at = Column(String)
    moderation_status = Column(String, default="pending") # pending, published, deleted
    scanned_at = Column(DateTime, default=datetime.utcnow)

class VideoScan(Base):
    __tablename__ = "video_scans"

    video_id = Column(String, primary_key=True, index=True)
    channel_id = Column(String, nullable=True)
    total_comments = Column(Integer, default=0)
    toxic_comments = Column(Integer, default=0)
    last_scanned = Column(DateTime, default=datetime.utcnow)
