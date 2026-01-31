# External Scheduling API

## Overview

The External Scheduling API allows **external servers** (video generation pipelines, content tools, automation systems) to submit videos directly to MediaPoster for scheduled posting.

**Base URL:** `http://localhost:5555/api/external`

## 🧠 Smart Scheduling (NEW)

MediaPoster can now **intelligently decide** when to post, instead of you specifying exact times:

```python
# Just tell MediaPoster which platforms - it decides optimal times
requests.post("http://localhost:5555/api/external/smart-schedule", json={
    "video_url": "https://example.com/video.mp4",
    "title": "My Video",
    "caption": "Check this out!",
    "platforms": ["tiktok", "youtube", "instagram"]
    # No scheduled_at needed! MediaPoster figures it out.
})
```

**Smart Scheduling Features:**
- ✅ Automatic rate limiting per account/platform
- ✅ Maintains consistent posting cadence
- ✅ Respects platform-specific limits (TikTok: 8/day, Instagram: 5/day, etc.)
- ✅ Spreads posts to avoid overwhelming accounts
- ✅ Conflict resolution with existing scheduled posts

---

## Flow

```
External Server                    MediaPoster                      Platforms
     │                                │                                │
     │  POST /api/external/submit     │                                │
     │  {video_url, targets[]}        │                                │
     │ ──────────────────────────────▶│                                │
     │                                │                                │
     │                                │ 1. Download video              │
     │                                │ 2. Ingest to media DB          │
     │                                │ 3. Create scheduled_posts      │
     │                                │                                │
     │◀──────────────────────────────│                                │
     │  {scheduled_posts[], video_id} │                                │
     │                                │                                │
     │                                │  [At scheduled time]           │
     │                                │  Post Scheduler runs           │
     │                                │ ────────────────────────────▶  │
     │                                │                   TikTok/YT/IG │
     │                                │                                │
     │  GET /api/external/status/{id} │                                │
     │ ──────────────────────────────▶│                                │
     │◀──────────────────────────────│                                │
     │  {status: "posted", url: ...}  │                                │
```

---

## Endpoints

### 1. Submit Single Video

```http
POST /api/external/submit
Content-Type: application/json
```

**Request:**
```json
{
  "video_url": "https://example.com/my-video.mp4",
  "title": "My Awesome Video",
  "caption": "Check this out! 🔥",
  "hashtags": ["#ai", "#automation", "#trending"],
  "targets": [
    {
      "platform": "tiktok",
      "account_id": "710",
      "scheduled_at": "2026-01-31T15:00:00Z"
    },
    {
      "platform": "youtube",
      "account_id": "228",
      "scheduled_at": "2026-01-31T16:00:00Z",
      "title": "Custom YouTube Title"
    },
    {
      "platform": "instagram",
      "account_id": "807",
      "scheduled_at": "2026-01-31T17:00:00Z",
      "caption": "Custom IG caption"
    }
  ],
  "source_id": "sora-batch-001",
  "source_system": "sora-pipeline",
  "thumbnail_url": "https://example.com/thumb.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "video_id": "abc123-uuid",
  "scheduled_posts": [
    {
      "id": "post-uuid-1",
      "platform": "tiktok",
      "account_id": "710",
      "scheduled_at": "2026-01-31T15:00:00Z",
      "status": "scheduled"
    },
    {
      "id": "post-uuid-2",
      "platform": "youtube",
      "account_id": "228",
      "scheduled_at": "2026-01-31T16:00:00Z",
      "status": "scheduled"
    }
  ],
  "message": "Video scheduled for 3 platform(s)"
}
```

---

### 2. Bulk Schedule (Multiple Videos with Frequency)

```http
POST /api/external/bulk-schedule
Content-Type: application/json
```

Schedule multiple videos at regular intervals.

**Request:**
```json
{
  "video_urls": [
    "https://example.com/video1.mp4",
    "https://example.com/video2.mp4",
    "https://example.com/video3.mp4"
  ],
  "title_template": "Daily Content #{n}",
  "caption_template": "Episode {n} of my series! 🎬 #content",
  "hashtags": ["#daily", "#series"],
  "platform": "tiktok",
  "account_id": "710",
  "start_time": "2026-01-31T15:00:00Z",
  "interval_minutes": 60,
  "source_system": "content-pipeline"
}
```

**Response:**
```json
{
  "success": true,
  "scheduled_posts": [
    {"id": "1", "platform": "tiktok", "scheduled_at": "2026-01-31T15:00:00Z"},
    {"id": "2", "platform": "tiktok", "scheduled_at": "2026-01-31T16:00:00Z"},
    {"id": "3", "platform": "tiktok", "scheduled_at": "2026-01-31T17:00:00Z"}
  ],
  "message": "Scheduled 3 videos from 2026-01-31T15:00:00Z with 60min intervals"
}
```

---

### 3. Check Submission Status

```http
GET /api/external/status/{source_id}
```

Track posts by your external reference ID.

**Response:**
```json
{
  "source_id": "sora-batch-001",
  "total": 3,
  "posts": [
    {
      "id": "post-1",
      "platform": "tiktok",
      "status": "posted",
      "scheduled_at": "2026-01-31T15:00:00Z",
      "platform_url": "https://tiktok.com/@user/video/123",
      "error": null
    },
    {
      "id": "post-2",
      "platform": "youtube",
      "status": "scheduled",
      "scheduled_at": "2026-01-31T16:00:00Z",
      "platform_url": null,
      "error": null
    }
  ]
}
```

---

### 4. List Available Accounts

```http
GET /api/external/accounts
```

Get all available Blotato account IDs for scheduling.

**Response:**
```json
{
  "accounts": {
    "tiktok": [
      {"id": "710", "username": "@isaiah_dupree"},
      {"id": "243", "username": "@the_isaiah_dupree"}
    ],
    "instagram": [
      {"id": "807", "username": "@the_isaiah_dupree"}
    ],
    "youtube": [
      {"id": "228", "username": "Isaiah Dupree"}
    ]
  }
}
```

---

### 5. Health Check

```http
GET /api/external/health
```

---

## Code Examples

### Python Client

```python
import requests
from datetime import datetime, timedelta

MEDIAPOSTER_URL = "http://localhost:5555"

def submit_video(video_url: str, title: str, caption: str, platforms: list):
    """Submit a video for scheduled posting."""
    
    # Build targets - schedule 1 hour apart
    base_time = datetime.utcnow() + timedelta(hours=1)
    targets = []
    
    for i, (platform, account_id) in enumerate(platforms):
        targets.append({
            "platform": platform,
            "account_id": account_id,
            "scheduled_at": (base_time + timedelta(hours=i)).isoformat() + "Z"
        })
    
    response = requests.post(
        f"{MEDIAPOSTER_URL}/api/external/submit",
        json={
            "video_url": video_url,
            "title": title,
            "caption": caption,
            "hashtags": ["#ai", "#content"],
            "targets": targets,
            "source_system": "my-pipeline"
        }
    )
    
    return response.json()

# Example usage
result = submit_video(
    video_url="https://storage.example.com/video.mp4",
    title="AI Generated Video",
    caption="Check out this AI-generated content!",
    platforms=[
        ("tiktok", "710"),
        ("youtube", "228"),
        ("instagram", "807")
    ]
)

print(f"Scheduled {len(result['scheduled_posts'])} posts")
```

### TypeScript/Node.js Client

```typescript
const MEDIAPOSTER_URL = 'http://localhost:5555';

interface ScheduleTarget {
  platform: string;
  account_id: string;
  scheduled_at: string;
  title?: string;
  caption?: string;
}

async function submitVideo(
  videoUrl: string,
  title: string,
  caption: string,
  targets: ScheduleTarget[]
) {
  const response = await fetch(`${MEDIAPOSTER_URL}/api/external/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: videoUrl,
      title,
      caption,
      hashtags: ['#ai', '#content'],
      targets,
      source_system: 'my-app'
    })
  });
  
  return response.json();
}

// Example: Schedule to TikTok and YouTube
const result = await submitVideo(
  'https://storage.example.com/video.mp4',
  'My Video',
  'Amazing content! 🔥',
  [
    { platform: 'tiktok', account_id: '710', scheduled_at: '2026-01-31T15:00:00Z' },
    { platform: 'youtube', account_id: '228', scheduled_at: '2026-01-31T16:00:00Z' }
  ]
);
```

### cURL

```bash
# Submit single video
curl -X POST http://localhost:5555/api/external/submit \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://example.com/video.mp4",
    "title": "My Video",
    "caption": "Check this out!",
    "targets": [
      {"platform": "tiktok", "account_id": "710", "scheduled_at": "2026-01-31T15:00:00Z"}
    ]
  }'

# Check status
curl http://localhost:5555/api/external/status/my-source-id

# List accounts
curl http://localhost:5555/api/external/accounts
```

---

## Account IDs Quick Reference

| Platform | ID | Username |
|----------|-----|----------|
| **TikTok** | 710 | @isaiah_dupree |
| | 243 | @the_isaiah_dupree |
| | 4508 | @dupree_isaiah |
| **Instagram** | 807 | @the_isaiah_dupree |
| | 670 | @the_isaiah_dupree_ |
| | 1369 | @dupree_isaiah_ |
| **YouTube** | 228 | Isaiah Dupree |
| | 3370 | lofi_creator |
| **Twitter** | 4151 | @IsaiahDupree7 |
| **Threads** | 173 | @the_isaiah_dupree_ |
| | 201 | @the_isaiah_dupree |

---

## Integration Patterns

### Pattern 1: Sora Video Pipeline

```python
# After Sora generates a video
def on_sora_video_ready(video_path: str, prompt: str):
    # Upload to cloud storage
    video_url = upload_to_storage(video_path)
    
    # Submit to MediaPoster
    submit_video(
        video_url=video_url,
        title=f"AI Video: {prompt[:50]}",
        caption=f"Created with AI ✨ {prompt}",
        platforms=[("tiktok", "710"), ("youtube", "228")]
    )
```

### Pattern 2: Batch Content Pipeline

```python
# Schedule a week's worth of content
def schedule_weekly_content(videos: list):
    requests.post(
        f"{MEDIAPOSTER_URL}/api/external/bulk-schedule",
        json={
            "video_urls": videos,
            "caption_template": "Day {n} content 📅",
            "platform": "tiktok",
            "account_id": "710",
            "start_time": "2026-02-01T12:00:00Z",
            "interval_minutes": 1440  # Once per day
        }
    )
```

### Pattern 3: Webhook Integration

```python
# Your server receives video generation completion webhook
@app.post("/webhook/video-ready")
async def handle_video_ready(payload: dict):
    # Forward to MediaPoster
    response = requests.post(
        f"{MEDIAPOSTER_URL}/api/external/submit",
        json={
            "video_url": payload["video_url"],
            "title": payload["title"],
            "caption": payload["description"],
            "targets": [
                {"platform": "tiktok", "account_id": "710", 
                 "scheduled_at": calculate_next_slot("tiktok")}
            ],
            "source_id": payload["job_id"],
            "source_system": "video-gen-service"
        }
    )
    return {"status": "scheduled", "mediaposter_response": response.json()}
```

---

## Error Handling

### Error Response Format
```json
{
  "detail": "Failed to download video: Connection timeout"
}
```

### Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Failed to download video | Check video URL is publicly accessible |
| 400 | Invalid platform | Use valid platform name (tiktok, instagram, youtube, etc.) |
| 400 | Invalid account_id | Check account exists via `/api/external/accounts` |
| 500 | Database error | Check MediaPoster backend is running |

---

## Rate Limits

- No hard rate limits on the external API
- Recommended: Max 100 submissions per minute
- Bulk schedule: Max 50 videos per request

---

## Related Documentation

- [Scheduling Quickstart](./SCHEDULING_QUICKSTART.md)
- [API Scheduling Complete Guide](./API_SCHEDULING_COMPLETE_GUIDE.md)
- [Blotato Account IDs](./API_SCHEDULING_COMPLETE_GUIDE.md#account-id-quick-reference)
