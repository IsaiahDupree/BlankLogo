"""
RunPod Serverless Handler for BlankLogo Watermark Removal

This handler receives video data, processes it with YOLO + LAMA,
and returns the cleaned video.

Usage:
    - Deploy to RunPod Serverless with GPU
    - Call via RunPod API with base64-encoded video

Input:
    {
        "input": {
            "video_base64": "...",       # Required: Base64 encoded video
            "mode": "inpaint",           # Optional: crop | inpaint | auto
            "platform": "sora",          # Optional: sora | tiktok | runway | pika
            "crop_pixels": 100,          # Optional: pixels to crop
            "crop_position": "bottom"    # Optional: top | bottom | left | right
        }
    }

Output:
    {
        "video_base64": "...",           # Base64 encoded processed video
        "stats": {
            "mode": "inpaint",
            "platform": "sora",
            "input_size_mb": 7.89,
            "output_size_mb": 7.12,
            "frames_processed": 246,
            "watermarks_detected": 246,
            "processing_time_s": 45.2
        }
    }
"""
import runpod
import base64
import tempfile
import os
import time
from pathlib import Path
from loguru import logger

from processor import VideoProcessor, ProcessingMode


def handler(event):
    """
    RunPod serverless handler for watermark removal.
    """
    start_time = time.time()
    
    try:
        logger.info("=" * 60)
        logger.info("[RunPod] ========== STARTING WATERMARK REMOVAL JOB ==========")
        logger.info("=" * 60)
        
        # Log environment info
        import torch
        logger.info(f"[RunPod] PyTorch version: {torch.__version__}")
        logger.info(f"[RunPod] CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            logger.info(f"[RunPod] CUDA device: {torch.cuda.get_device_name(0)}")
            logger.info(f"[RunPod] CUDA memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
        
        # Parse input
        input_data = event.get("input", {})
        video_b64 = input_data.get("video_base64")
        mode = input_data.get("mode", "inpaint")
        platform = input_data.get("platform", "sora")
        crop_pixels = input_data.get("crop_pixels", 100)
        crop_position = input_data.get("crop_position", "bottom")
        
        if not video_b64:
            logger.error("[RunPod] ❌ Missing video_base64 in input")
            return {"error": "Missing video_base64 in input"}
        
        logger.info(f"[RunPod] Mode: {mode}")
        logger.info(f"[RunPod] Platform: {platform}")
        logger.info(f"[RunPod] Crop pixels: {crop_pixels}")
        logger.info(f"[RunPod] Crop position: {crop_position}")
        
        # Decode video to temp file
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, "input.mp4")
            output_path = os.path.join(tmp_dir, "output.mp4")
            
            # Write input video
            logger.info("[RunPod] Decoding input video from base64...")
            try:
                video_bytes = base64.b64decode(video_b64)
            except Exception as decode_err:
                logger.error(f"[RunPod] ❌ Base64 decode failed: {decode_err}")
                return {"error": f"Invalid base64 video data: {decode_err}"}
            
            with open(input_path, "wb") as f:
                f.write(video_bytes)
            
            input_size_mb = len(video_bytes) / (1024 * 1024)
            logger.info(f"[RunPod] Input video size: {input_size_mb:.2f} MB")
            
            # Process video
            logger.info("[RunPod] Initializing video processor...")
            processor = VideoProcessor(mode=ProcessingMode(mode))
            
            logger.info("[RunPod] Processing video...")
            process_start = time.time()
            result = processor.process(
                input_path, 
                output_path,
                crop_pixels=crop_pixels,
                crop_position=crop_position
            )
            process_time = time.time() - process_start
            
            logger.info(f"[RunPod] Processing completed in {process_time:.2f}s")
            logger.info(f"[RunPod] Result: {result}")
            
            # Verify output exists
            if not os.path.exists(output_path):
                logger.error("[RunPod] ❌ Output file not created")
                return {"error": "Processing failed - output file not created"}
            
            # Encode output video
            logger.info("[RunPod] Encoding output video to base64...")
            with open(output_path, "rb") as f:
                output_bytes = f.read()
            output_b64 = base64.b64encode(output_bytes).decode("utf-8")
            
            output_size_mb = len(output_bytes) / (1024 * 1024)
            total_time = time.time() - start_time
            
            logger.info(f"[RunPod] Output video size: {output_size_mb:.2f} MB")
            logger.info(f"[RunPod] Total job time: {total_time:.2f}s")
            
            logger.info("=" * 60)
            logger.info("[RunPod] ✅ JOB COMPLETED SUCCESSFULLY!")
            logger.info("=" * 60)
            
            return {
                "video_base64": output_b64,
                "stats": {
                    "mode": mode,
                    "platform": platform,
                    "input_size_mb": round(input_size_mb, 2),
                    "output_size_mb": round(output_size_mb, 2),
                    "frames_processed": result.get("frames_processed", 0),
                    "watermarks_detected": result.get("watermarks_detected", 0),
                    "processing_time_s": round(process_time, 2),
                    "total_time_s": round(total_time, 2)
                }
            }
            
    except Exception as e:
        logger.error(f"[RunPod] ❌ JOB FAILED: {e}")
        import traceback
        logger.error(f"[RunPod] Full traceback:\n{traceback.format_exc()}")
        return {"error": str(e), "traceback": traceback.format_exc()}


# Health check function
def health_check(_):
    """RunPod health check."""
    return {"status": "healthy"}


if __name__ == "__main__":
    logger.info("[RunPod] Starting RunPod Serverless Handler...")
    logger.info("[RunPod] Preloading models for faster cold starts...")
    
    # Preload models
    try:
        from detector import get_yolo_model
        from inpainter import get_lama_model
        
        logger.info("[RunPod] Loading YOLO model...")
        get_yolo_model()
        
        logger.info("[RunPod] Loading LAMA model...")
        get_lama_model()
        
        logger.info("[RunPod] ✅ Models preloaded successfully!")
    except Exception as e:
        logger.error(f"[RunPod] ⚠️ Model preload failed (will load on first request): {e}")
    
    # Start RunPod serverless
    runpod.serverless.start({
        "handler": handler,
        "return_aggregate_stream": True
    })
