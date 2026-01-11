"""
RunPod Serverless Handler

Processes videos for watermark removal using YOLO detection and LAMA inpainting.
Dependencies and models are pre-installed in the Docker image.
"""
import runpod
import os
import sys
import base64
import tempfile
import time

print("[Handler] Starting up...")

# Import modules (already installed in Docker image)
try:
    from processor import VideoProcessor, ProcessingMode
    from loguru import logger
    from detector import get_yolo_model
    from inpainter import get_lama_model
    
    print("[Handler] Loading models...")
    get_yolo_model()
    get_lama_model()
    print("[Handler] Models loaded - ready for requests!")
except Exception as e:
    print(f"[Handler] Import error: {e}")
    # Fallback: try to import from expected Docker path
    sys.path.insert(0, "/app/BlankLogo/apps/worker/python")
    from processor import VideoProcessor, ProcessingMode
    from loguru import logger
    from detector import get_yolo_model
    from inpainter import get_lama_model
    get_yolo_model()
    get_lama_model()
    print("[Handler] Models loaded (fallback path)")


def handler(event):
    """
    RunPod Serverless Handler
    
    Input:
        video_base64: Base64 encoded video
        mode: "crop" | "inpaint" | "auto"
        platform: "sora" | "tiktok" | "runway"
    
    Output:
        video_base64: Processed video
        stats: Processing statistics
    """
    try:
        start_time = time.time()
        input_data = event.get("input", {})
        
        video_b64 = input_data.get("video_base64")
        mode = input_data.get("mode", "inpaint")
        platform = input_data.get("platform", "sora")
        
        if not video_b64:
            return {"error": "Missing video_base64"}
        
        logger.info(f"[Handler] Processing: mode={mode}, platform={platform}")
        
        # Decode video
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, "input.mp4")
            output_path = os.path.join(tmp_dir, "output.mp4")
            
            video_bytes = base64.b64decode(video_b64)
            with open(input_path, "wb") as f:
                f.write(video_bytes)
            
            input_mb = len(video_bytes) / 1024 / 1024
            logger.info(f"[Handler] Input: {input_mb:.2f} MB")
            
            # Process
            processor = VideoProcessor(mode=ProcessingMode(mode))
            result = processor.process(input_path, output_path)
            
            # Encode output
            with open(output_path, "rb") as f:
                output_bytes = f.read()
            output_b64 = base64.b64encode(output_bytes).decode()
            
            output_mb = len(output_bytes) / 1024 / 1024
            total_time = time.time() - start_time
            
            logger.info(f"[Handler] Output: {output_mb:.2f} MB, Time: {total_time:.2f}s")
            
            return {
                "video_base64": output_b64,
                "stats": {
                    "mode": mode,
                    "platform": platform,
                    "input_size_mb": round(input_mb, 2),
                    "output_size_mb": round(output_mb, 2),
                    "frames_processed": result.get("frames_processed", 0),
                    "watermarks_detected": result.get("watermarks_detected", 0),
                    "processing_time_s": round(total_time, 2),
                }
            }
            
    except Exception as e:
        logger.error(f"[Handler] Error: {e}")
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


# Start RunPod serverless
runpod.serverless.start({"handler": handler})
