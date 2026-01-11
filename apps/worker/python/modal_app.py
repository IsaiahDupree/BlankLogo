"""
Modal Serverless GPU App for BlankLogo Watermark Removal

Deploy: modal deploy modal_app.py
Test:   modal run modal_app.py
"""
import modal

# Define the Modal app
app = modal.App("blanklogo-watermark-removal")

# Create image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch==2.1.0",
        "torchvision==0.16.0",
        "ultralytics",
        "loguru",
        "tqdm",
        "ffmpeg-python",
        "numpy<2",
        "opencv-python-headless",
        "fastapi",
    )
    .run_commands(
        "git clone --depth 1 https://github.com/IsaiahDupree/BlankLogo.git /app/BlankLogo"
    )
)

# GPU configuration - use A10G (good balance of cost/performance)
gpu_config = modal.gpu.A10G()


@app.cls(
    image=image,
    gpu=gpu_config,
    timeout=600,  # 10 minute timeout
    container_idle_timeout=60,  # Keep warm for 60s
)
class WatermarkRemover:
    """Modal class for watermark removal with GPU acceleration."""

    @modal.enter()
    def setup(self):
        """Load models on container start (cold start optimization)."""
        import sys
        sys.path.insert(0, "/app/BlankLogo/apps/worker/python")
        
        from detector import get_yolo_model
        from inpainter import get_lama_model
        from loguru import logger
        
        logger.info("[Modal] Loading YOLO model...")
        self.yolo = get_yolo_model()
        
        logger.info("[Modal] Loading LAMA model...")
        self.lama = get_lama_model()
        
        logger.info("[Modal] Models loaded - ready for requests!")

    @modal.method()
    def process_video(self, video_bytes: bytes, mode: str = "inpaint", platform: str = "sora") -> dict:
        """
        Process a video to remove watermarks.
        
        Args:
            video_bytes: Raw video bytes
            mode: "crop" | "inpaint" | "auto"
            platform: "sora" | "tiktok" | "runway"
            
        Returns:
            dict with processed video bytes and stats
        """
        import sys
        import tempfile
        import time
        
        sys.path.insert(0, "/app/BlankLogo/apps/worker/python")
        from processor import VideoProcessor, ProcessingMode
        from loguru import logger
        
        start_time = time.time()
        logger.info(f"[Modal] Processing: mode={mode}, platform={platform}")
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = f"{tmp_dir}/input.mp4"
            output_path = f"{tmp_dir}/output.mp4"
            
            # Write input video
            with open(input_path, "wb") as f:
                f.write(video_bytes)
            
            input_mb = len(video_bytes) / 1024 / 1024
            logger.info(f"[Modal] Input: {input_mb:.2f} MB")
            
            # Process video
            processor = VideoProcessor(mode=ProcessingMode(mode))
            result = processor.process(input_path, output_path)
            
            # Read output video
            with open(output_path, "rb") as f:
                output_bytes = f.read()
            
            output_mb = len(output_bytes) / 1024 / 1024
            total_time = time.time() - start_time
            
            logger.info(f"[Modal] Output: {output_mb:.2f} MB, Time: {total_time:.2f}s")
            
            return {
                "video_bytes": output_bytes,
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

    @modal.method()
    def health_check(self) -> dict:
        """Check if the service is healthy and models are loaded."""
        return {
            "status": "healthy",
            "yolo_loaded": self.yolo is not None,
            "lama_loaded": self.lama is not None,
        }


# Web endpoint for health check
@app.function(image=image)
@modal.web_endpoint(method="GET")
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "blanklogo-watermark-removal"}


# Web endpoint for video processing (called by Render worker)
@app.function(image=image, gpu=gpu_config, timeout=600, container_idle_timeout=60)
@modal.web_endpoint(method="POST")
def process_video_http(request: dict):
    """
    HTTP endpoint for video processing.
    
    Request body:
        video_bytes: base64-encoded video
        mode: "inpaint" | "crop" | "auto"
        platform: "sora" | "tiktok" | "runway"
    
    Response:
        video_bytes: base64-encoded processed video
        stats: processing statistics
    """
    import sys
    import base64
    import tempfile
    import time
    
    sys.path.insert(0, "/app/BlankLogo/apps/worker/python")
    from processor import VideoProcessor, ProcessingMode
    from detector import get_yolo_model
    from inpainter import get_lama_model
    from loguru import logger
    
    # Load models
    logger.info("[Modal HTTP] Loading models...")
    get_yolo_model()
    get_lama_model()
    
    # Parse request
    video_b64 = request.get("video_bytes", "")
    mode = request.get("mode", "inpaint")
    platform = request.get("platform", "sora")
    
    video_bytes = base64.b64decode(video_b64)
    
    start_time = time.time()
    logger.info(f"[Modal HTTP] Processing: mode={mode}, platform={platform}")
    logger.info(f"[Modal HTTP] Input size: {len(video_bytes) / 1024 / 1024:.2f} MB")
    
    with tempfile.TemporaryDirectory() as tmp_dir:
        input_path = f"{tmp_dir}/input.mp4"
        output_path = f"{tmp_dir}/output.mp4"
        
        # Write input video
        with open(input_path, "wb") as f:
            f.write(video_bytes)
        
        # Process video
        processor = VideoProcessor(mode=ProcessingMode(mode))
        result = processor.process(input_path, output_path)
        
        # Read output video
        with open(output_path, "rb") as f:
            output_bytes = f.read()
        
        total_time = time.time() - start_time
        
        logger.info(f"[Modal HTTP] Output: {len(output_bytes) / 1024 / 1024:.2f} MB")
        logger.info(f"[Modal HTTP] Time: {total_time:.2f}s")
        
        return {
            "video_bytes": base64.b64encode(output_bytes).decode("utf-8"),
            "stats": {
                "mode": mode,
                "platform": platform,
                "input_size_mb": round(len(video_bytes) / 1024 / 1024, 2),
                "output_size_mb": round(len(output_bytes) / 1024 / 1024, 2),
                "frames_processed": result.get("frames_processed", 0),
                "watermarks_detected": result.get("watermarks_detected", 0),
                "processing_time_s": round(total_time, 2),
            }
        }


# Local testing
@app.local_entrypoint()
def main():
    """Test the watermark removal locally."""
    import os
    
    print("Testing BlankLogo Modal App...")
    
    # Test health check
    remover = WatermarkRemover()
    health = remover.health_check.remote()
    print(f"Health check: {health}")
    
    # Test with a sample video if available
    test_video = "test-videos/sora-watermark-test.mp4"
    if os.path.exists(test_video):
        print(f"Processing test video: {test_video}")
        with open(test_video, "rb") as f:
            video_bytes = f.read()
        
        result = remover.process_video.remote(video_bytes, mode="inpaint", platform="sora")
        print(f"Stats: {result['stats']}")
        
        # Save output
        output_path = "test-videos/modal-output.mp4"
        with open(output_path, "wb") as f:
            f.write(result["video_bytes"])
        print(f"Output saved to: {output_path}")
    else:
        print(f"No test video found at {test_video}")
    
    print("Done!")
