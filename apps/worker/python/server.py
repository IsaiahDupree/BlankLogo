"""
BlankLogo Inpainting Server
FastAPI server for Python-based watermark removal.
Called by the Node.js worker for quality mode processing.
"""
import os
import tempfile
import shutil
from pathlib import Path
from typing import Optional
from enum import Enum

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from loguru import logger

from processor import VideoProcessor, ProcessingMode

app = FastAPI(
    title="BlankLogo Inpainting Service",
    description="Python-based watermark detection and removal using YOLO + LAMA",
    version="1.0.0"
)

# Store for job progress
job_progress = {}

# Temp directory for processing
TEMP_DIR = Path(tempfile.gettempdir()) / "blanklogo_inpaint"
TEMP_DIR.mkdir(exist_ok=True)


class ProcessRequest(BaseModel):
    """Request body for processing endpoint."""
    mode: str = "crop"
    crop_pixels: int = 100
    crop_position: str = "bottom"


class JobStatus(BaseModel):
    """Job status response."""
    job_id: str
    status: str
    progress: int = 0
    result: Optional[dict] = None
    error: Optional[str] = None


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "blanklogo-inpainter"}


@app.get("/capabilities")
async def get_capabilities():
    """Return service capabilities and supported formats."""
    return {
        "service": "blanklogo-inpainter",
        "version": "1.0.0",
        "capabilities": {
            "modes": ["crop", "inpaint", "auto"],
            "crop_positions": ["top", "bottom", "left", "right"],
            "supported_formats": ["mp4", "mov", "webm", "avi"],
            "max_file_size_mb": 500,
            "max_duration_sec": 300,
        },
        "features": {
            "async_processing": True,
            "progress_tracking": True,
            "gpu_acceleration": False,  # Render free tier doesn't have GPU
        }
    }


@app.post("/process")
async def process_video(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    mode: str = Form("crop"),
    crop_pixels: int = Form(100),
    crop_position: str = Form("bottom"),
    job_id: Optional[str] = Form(None)
):
    """
    Process a video to remove watermarks.
    
    Args:
        video: Input video file
        mode: Processing mode (crop, inpaint, auto)
        crop_pixels: Pixels to crop (for crop mode)
        crop_position: Position to crop (top, bottom, left, right)
        job_id: Optional job ID for tracking
    
    Returns:
        Processed video file
    """
    if job_id is None:
        import uuid
        job_id = str(uuid.uuid4())
    
    # Create temp directory for this job
    job_dir = TEMP_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    
    input_path = job_dir / "input.mp4"
    output_path = job_dir / "output.mp4"
    
    try:
        # Save uploaded file
        logger.info(f"Job {job_id}: Saving uploaded video")
        with open(input_path, "wb") as f:
            content = await video.read()
            f.write(content)
        
        # Initialize progress
        job_progress[job_id] = {"progress": 0, "status": "processing"}
        
        def progress_callback(progress: int):
            job_progress[job_id]["progress"] = progress
        
        # Process video
        logger.info(f"Job {job_id}: Processing with mode={mode}")
        processor = VideoProcessor(mode=ProcessingMode(mode))
        
        result = processor.process(
            str(input_path),
            str(output_path),
            crop_pixels=crop_pixels,
            crop_position=crop_position,
            progress_callback=progress_callback
        )
        
        job_progress[job_id] = {
            "progress": 100, 
            "status": "completed",
            "result": result
        }
        
        logger.info(f"Job {job_id}: Processing complete")
        
        # Return the processed video
        return FileResponse(
            str(output_path),
            media_type="video/mp4",
            filename=f"processed_{job_id}.mp4",
            background=BackgroundTasks()  # Cleanup handled separately
        )
        
    except Exception as e:
        logger.error(f"Job {job_id}: Processing failed - {e}")
        job_progress[job_id] = {
            "progress": 0,
            "status": "failed",
            "error": str(e)
        }
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process/async")
async def process_video_async(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    mode: str = Form("crop"),
    crop_pixels: int = Form(100),
    crop_position: str = Form("bottom"),
    job_id: Optional[str] = Form(None)
):
    """
    Start async video processing. Returns job_id immediately.
    Use /status/{job_id} to check progress.
    """
    if job_id is None:
        import uuid
        job_id = str(uuid.uuid4())
    
    # Create temp directory for this job
    job_dir = TEMP_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    
    input_path = job_dir / "input.mp4"
    output_path = job_dir / "output.mp4"
    
    # Save uploaded file
    with open(input_path, "wb") as f:
        content = await video.read()
        f.write(content)
    
    # Initialize progress
    job_progress[job_id] = {"progress": 0, "status": "queued"}
    
    def process_task():
        try:
            job_progress[job_id]["status"] = "processing"
            
            def progress_callback(progress: int):
                job_progress[job_id]["progress"] = progress
            
            processor = VideoProcessor(mode=ProcessingMode(mode))
            result = processor.process(
                str(input_path),
                str(output_path),
                crop_pixels=crop_pixels,
                crop_position=crop_position,
                progress_callback=progress_callback
            )
            
            job_progress[job_id] = {
                "progress": 100,
                "status": "completed",
                "result": result,
                "output_path": str(output_path)
            }
        except Exception as e:
            logger.error(f"Job {job_id}: {e}")
            job_progress[job_id] = {
                "progress": 0,
                "status": "failed",
                "error": str(e)
            }
    
    background_tasks.add_task(process_task)
    
    return {"job_id": job_id, "status": "queued"}


@app.get("/status/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of an async processing job."""
    if job_id not in job_progress:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatus(job_id=job_id, **job_progress[job_id])


@app.get("/download/{job_id}")
async def download_result(job_id: str, background_tasks: BackgroundTasks):
    """Download the processed video for a completed job."""
    if job_id not in job_progress:
        raise HTTPException(status_code=404, detail="Job not found")
    
    status = job_progress[job_id]
    
    if status["status"] != "completed":
        raise HTTPException(
            status_code=400, 
            detail=f"Job not completed. Current status: {status['status']}"
        )
    
    output_path = status.get("output_path")
    if not output_path or not Path(output_path).exists():
        raise HTTPException(status_code=404, detail="Output file not found")
    
    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"processed_{job_id}.mp4"
    )


@app.delete("/cleanup/{job_id}")
async def cleanup_job(job_id: str):
    """Clean up temp files for a job."""
    job_dir = TEMP_DIR / job_id
    
    if job_dir.exists():
        shutil.rmtree(job_dir)
    
    if job_id in job_progress:
        del job_progress[job_id]
    
    return {"status": "cleaned", "job_id": job_id}


@app.on_event("startup")
async def startup():
    """Startup event - preload models if GPU available."""
    logger.info("BlankLogo Inpainting Service starting...")
    
    # Optionally preload models
    if os.environ.get("PRELOAD_MODELS", "false").lower() == "true":
        logger.info("Preloading models...")
        try:
            from detector import get_yolo_model
            from inpainter import get_lama_model
            get_yolo_model()
            get_lama_model()
            logger.info("Models preloaded")
        except Exception as e:
            logger.warning(f"Failed to preload models: {e}")


if __name__ == "__main__":
    import uvicorn
    
    # Render uses PORT env var, fallback to INPAINT_PORT or 8081
    port = int(os.environ.get("PORT", os.environ.get("INPAINT_PORT", 8081)))
    uvicorn.run(app, host="0.0.0.0", port=port)
