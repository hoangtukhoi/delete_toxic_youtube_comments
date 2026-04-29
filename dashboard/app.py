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
from pyvi import ViTokenizer
from typing import List, Optional

app = FastAPI()

# ==========================================
# 🧠 AI Model Setup (Singleton)
# ==========================================
MODEL_PATH = "hoangkkk/phobert-v2-vietnamese-sentiment"
print("🚀 Loading PhoBERT AI brain... This might take a moment.")
tokenizer = AutoTokenizer.from_pretrained("vinai/phobert-base-v2", use_fast=False)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
print("✅ AI brain loaded and ready!")

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

@app.get("/api/comments")
async def get_comments(video_id: str):
    try:
        youtube = get_youtube_service()
        request = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            textFormat="plainText",
            maxResults=100
        )
        response = request.execute()
        
        comments = []
        for item in response.get("items", []):
            snippet = item["snippet"]["topLevelComment"]["snippet"]
            text = snippet["textDisplay"]
            is_toxic, confidence = get_toxicity_prediction(text)
            
            comments.append({
                "id": item["id"],
                "author": snippet["authorDisplayName"],
                "author_image": snippet.get("authorProfileImageUrl", ""),
                "text": text,
                "is_toxic": is_toxic,
                "confidence": round(confidence * 100, 1),
                "published_at": snippet["publishedAt"]
            })
        
        return {"comments": comments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/approve")
async def approve_comment(action: CommentAction):
    try:
        youtube = get_youtube_service()
        # Publish the comment (if it was held for review)
        youtube.comments().setModerationStatus(
            id=action.comment_id,
            moderationStatus="published"
        ).execute()
        return {"status": "success", "message": "Comment approved and published!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete")
async def delete_comment(action: CommentAction):
    try:
        youtube = get_youtube_service()
        youtube.comments().delete(id=action.comment_id).execute()
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
