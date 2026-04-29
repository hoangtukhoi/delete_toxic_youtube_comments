import os
import torch
import json
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import Depends, BackgroundTasks
import uuid
from pyvi import ViTokenizer
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dashboard.database import engine, get_db, SessionLocal, Base
from dashboard.models import Comment, VideoScan

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

scan_progress = {}

# ==========================================
# 🧠 AI Model Setup (Singleton)
# ==========================================
MODEL_PATH = "hoangkkk/phobert-v2-vietnamese-sentiment"
print("Loading PhoBERT AI brain... This might take a moment.")
tokenizer = AutoTokenizer.from_pretrained("vinai/phobert-base-v2", use_fast=False)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
print("AI brain loaded and ready!")

def segment_text(text):
    return ViTokenizer.tokenize(str(text))

def get_toxicity_prediction(text):
    segmented_text = segment_text(text)
    inputs = tokenizer(segmented_text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        outputs = model(**inputs)
    probs = torch.softmax(outputs.logits, dim=-1)
    prediction = torch.argmax(probs, dim=-1).item()
    confidence = torch.max(probs).item()
    return prediction == 1, confidence

# ==========================================
# 📺 YouTube API Setup
# ==========================================
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
CLIENT_SECRET_FILE = "client_secret.json"
youtube_service = None

def get_youtube_service():
    global youtube_service
    if youtube_service:
        return youtube_service
    
    # Using InstalledAppFlow for local development
    # In a production web app, you'd use a more complex redirect flow
    flow = InstalledAppFlow.from_client_secrets_file(
        CLIENT_SECRET_FILE, SCOPES, redirect_uri='http://localhost:8080/'
    )
    # This will trigger a local browser for auth if not authenticated
    # For now, we assume credentials are handled or redirected
    # We might need to simplify this for the dashboard users
    credentials = flow.run_local_server(port=8080, prompt='consent')
    youtube_service = build("youtube", "v3", credentials=credentials)
    return youtube_service

# ==========================================
# 🏗️ API Models & Routes
# ==========================================
class CommentAction(BaseModel):
    comment_id: str
    video_id: str

class ScanRequest(BaseModel):
    target_id: str
    scan_type: str # 'video' or 'channel'

def process_video_comments(youtube, db: Session, video_id: str, task_id: str, current_video_idx=1, total_videos=1):
    scan_progress[task_id]["message"] = f"Fetching comments for video {video_id} ({current_video_idx}/{total_videos})"
    next_page_token = None
    total_processed = 0
    
    while True:
        try:
            request = youtube.commentThreads().list(
                part="snippet",
                videoId=video_id,
                textFormat="plainText",
                maxResults=100,
                pageToken=next_page_token
            )
            response = request.execute()
        except Exception as e:
            print(f"Error fetching video {video_id}: {e}")
            break
            
        items = response.get("items", [])
        if not items:
            break
            
        for item in items:
            comment_id = item["id"]
            existing = db.query(Comment).filter(Comment.id == comment_id).first()
            if not existing:
                snippet = item["snippet"]["topLevelComment"]["snippet"]
                text = snippet["textDisplay"]
                is_toxic, confidence = get_toxicity_prediction(text)
                confidence_percent = round(confidence * 100, 1)
                moderation_status = "pending"
                
                if is_toxic and confidence_percent > 95.0:
                    try:
                        youtube.comments().delete(id=comment_id).execute()
                        moderation_status = "deleted"
                    except:
                        pass
                
                new_comment = Comment(
                    id=comment_id,
                    video_id=video_id,
                    author=snippet["authorDisplayName"],
                    author_image=snippet.get("authorProfileImageUrl", ""),
                    text=text,
                    is_toxic=is_toxic,
                    confidence=confidence_percent,
                    published_at=snippet["publishedAt"],
                    moderation_status=moderation_status
                )
                db.add(new_comment)
            total_processed += 1
            
            if total_processed % 10 == 0:
                scan_progress[task_id]["progress"] = total_processed
                db.commit()
                
        db.commit()
        
        next_page_token = response.get("nextPageToken")
        if not next_page_token:
            break

def scan_task_runner(task_id: str, target_id: str, scan_type: str):
    db = SessionLocal()
    youtube = get_youtube_service()
    try:
        if scan_type == "video":
            process_video_comments(youtube, db, target_id, task_id)
        elif scan_type == "channel":
            scan_progress[task_id]["message"] = "Fetching latest videos for channel..."
            request = youtube.search().list(
                part="id",
                channelId=target_id,
                order="date",
                type="video",
                maxResults=5
            )
            response = request.execute()
            video_ids = [item["id"]["videoId"] for item in response.get("items", [])]
            
            for i, vid in enumerate(video_ids):
                process_video_comments(youtube, db, vid, task_id, i+1, len(video_ids))
                
        scan_progress[task_id]["status"] = "completed"
        scan_progress[task_id]["message"] = "Scan completed!"
    except Exception as e:
        scan_progress[task_id]["status"] = "error"
        scan_progress[task_id]["message"] = f"Error: {str(e)}"
    finally:
        db.close()

@app.post("/api/scan")
async def start_scan(req: ScanRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    scan_progress[task_id] = {
        "status": "scanning", 
        "progress": 0, 
        "message": "Initializing...",
        "target_id": req.target_id,
        "scan_type": req.scan_type
    }
    background_tasks.add_task(scan_task_runner, task_id, req.target_id, req.scan_type)
    return {"task_id": task_id}

@app.get("/api/scan-progress/{task_id}")
async def get_scan_progress(task_id: str):
    if task_id not in scan_progress:
        raise HTTPException(status_code=404, detail="Task not found")
    return scan_progress[task_id]

@app.get("/api/comments")
async def get_comments(
    target_id: str, 
    scan_type: str = "video", 
    page: int = 1, 
    limit: int = 50, 
    filter_type: str = "all", 
    search: str = "", 
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Comment).filter(Comment.moderation_status != "deleted")
        if scan_type == "video":
            query = query.filter(Comment.video_id == target_id)
            
        if filter_type == "toxic":
            query = query.filter(Comment.is_toxic == True)
        elif filter_type == "clean":
            query = query.filter(Comment.is_toxic == False)
            
        if search:
            query = query.filter(Comment.text.ilike(f"%{search}%"))
            
        total = query.count()
        offset = (page - 1) * limit
        db_comments = query.order_by(Comment.published_at.desc()).offset(offset).limit(limit).all()
        
        comments = []
        for c in db_comments:
            comments.append({
                "id": c.id,
                "author": c.author,
                "author_image": c.author_image,
                "text": c.text,
                "is_toxic": c.is_toxic,
                "confidence": c.confidence,
                "published_at": c.published_at,
                "moderation_status": c.moderation_status
            })
            
        return {"comments": comments, "total": total, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 📊 Analytics & Export Routes
# ==========================================
import io
import csv
from fastapi.responses import StreamingResponse
from collections import defaultdict

@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    comments = db.query(Comment).all()
    
    total = len(comments)
    toxic = sum(1 for c in comments if c.is_toxic)
    
    author_counts = defaultdict(int)
    trend = defaultdict(lambda: {"toxic": 0, "clean": 0})
    
    for c in comments:
        # Top users
        if c.is_toxic:
            author_counts[c.author] += 1
            
        # Trend over time (YYYY-MM-DD)
        if c.published_at:
            date_str = c.published_at[:10]
            if c.is_toxic:
                trend[date_str]["toxic"] += 1
            else:
                trend[date_str]["clean"] += 1
                
    top_users = sorted(author_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    trend_sorted = sorted(trend.items(), key=lambda x: x[0])[-30:] # Last 30 days
    
    return {
        "summary": {"total": total, "toxic": toxic},
        "top_users": [{"author": k, "toxic_count": v} for k, v in top_users],
        "trend": [{"date": k, "toxic": v["toxic"], "clean": v["clean"]} for k, v in trend_sorted]
    }

@app.get("/api/export")
def export_csv(db: Session = Depends(get_db)):
    comments = db.query(Comment).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Video ID", "Author", "Text", "Is Toxic", "Confidence", "Status", "Published At"])
    for c in comments:
        writer.writerow([c.id, c.video_id, c.author, c.text.replace("\n", " "), c.is_toxic, c.confidence, c.moderation_status, c.published_at])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": "attachment; filename=comments_export.csv"}
    )

@app.post("/api/approve")
async def approve_comment(action: CommentAction, db: Session = Depends(get_db)):
    try:
        youtube = get_youtube_service()
        youtube.comments().setModerationStatus(
            id=action.comment_id,
            moderationStatus="published"
        ).execute()
        
        comment = db.query(Comment).filter(Comment.id == action.comment_id).first()
        if comment:
            comment.moderation_status = "published"
            db.commit()
            
        return {"status": "success", "message": "Comment approved and published!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete")
async def delete_comment(action: CommentAction, db: Session = Depends(get_db)):
    try:
        youtube = get_youtube_service()
        youtube.comments().delete(id=action.comment_id).execute()
        
        comment = db.query(Comment).filter(Comment.id == action.comment_id).first()
        if comment:
            comment.moderation_status = "deleted"
            db.commit()
            
        return {"status": "success", "message": "Comment deleted permanently!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 🏠 Frontend Serving
# ==========================================
app.mount("/static", StaticFiles(directory="dashboard/static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_index():
    with open("dashboard/static/index.html", "r", encoding="utf-8") as f:
        return f.read()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=5000)
