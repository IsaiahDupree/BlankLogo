"""
BlankLogo AI Video Upscaler
Uses Real-ESRGAN for high-quality video upscaling on GPU.
"""
import os
import tempfile
from pathlib import Path
from typing import List, Optional
import urllib.request

import numpy as np
import cv2
import torch
from loguru import logger
from tqdm import tqdm

# Lazy load Real-ESRGAN model
_esrgan_model = None

MODELS_DIR = Path(__file__).parent / "models"

# Real-ESRGAN model URLs
ESRGAN_MODELS = {
    "realesrgan-x2": {
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
        "scale": 2,
    },
    "realesrgan-x4": {
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        "scale": 4,
    },
}


def get_device() -> str:
    """Get the best available device for inference."""
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def download_model(url: str, dest: Path) -> None:
    """Download model weights if not present."""
    if dest.exists():
        return
    
    logger.info(f"[ESRGAN] Downloading model to {dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    logger.info("[ESRGAN] Download complete")


def get_esrgan_model(scale: int = 2):
    """
    Load Real-ESRGAN model.
    
    Args:
        scale: Upscale factor (2 or 4)
    """
    global _esrgan_model
    
    model_key = f"realesrgan-x{scale}"
    if model_key not in ESRGAN_MODELS:
        raise ValueError(f"Unsupported scale: {scale}. Use 2 or 4.")
    
    # Check if we need to reload for different scale
    if _esrgan_model is not None and _esrgan_model.get("scale") == scale:
        return _esrgan_model
    
    logger.info(f"[ESRGAN] ========== INITIALIZING REAL-ESRGAN {scale}x ==========")
    
    try:
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer
        
        model_info = ESRGAN_MODELS[model_key]
        weights_path = MODELS_DIR / f"RealESRGAN_x{scale}plus.pth"
        
        # Download if needed
        download_model(model_info["url"], weights_path)
        
        device = get_device()
        logger.info(f"[ESRGAN] Device: {device}")
        
        # Create model architecture
        if scale == 2:
            model = RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64, 
                num_block=23, num_grow_ch=32, scale=2
            )
        else:  # scale == 4
            model = RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64, 
                num_block=23, num_grow_ch=32, scale=4
            )
        
        # Create upsampler
        upsampler = RealESRGANer(
            scale=scale,
            model_path=str(weights_path),
            model=model,
            tile=0,  # 0 for no tiling (faster if enough VRAM)
            tile_pad=10,
            pre_pad=0,
            half=True if device == "cuda" else False,  # FP16 on CUDA
            device=device,
        )
        
        _esrgan_model = {
            "upsampler": upsampler,
            "scale": scale,
            "device": device,
        }
        
        logger.info(f"[ESRGAN] ✅ Model loaded successfully on {device}")
        logger.info("[ESRGAN] ==========================================")
        
    except ImportError as e:
        logger.error(f"[ESRGAN] ❌ Import error: {e}")
        logger.error("[ESRGAN] Make sure basicsr and realesrgan are installed")
        raise
    except Exception as e:
        logger.error(f"[ESRGAN] ❌ Failed to load model: {e}")
        import traceback
        logger.error(f"[ESRGAN] Traceback:\n{traceback.format_exc()}")
        raise
    
    return _esrgan_model


class VideoUpscaler:
    """Upscales video frames using Real-ESRGAN."""
    
    def __init__(self, scale: int = 2):
        """
        Initialize upscaler.
        
        Args:
            scale: Upscale factor (2 or 4)
        """
        self.scale = scale
        self.model = get_esrgan_model(scale)
    
    def upscale_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Upscale a single frame.
        
        Args:
            frame: BGR image (H, W, 3)
            
        Returns:
            Upscaled BGR image
        """
        upsampler = self.model["upsampler"]
        
        # Real-ESRGAN expects BGR input
        output, _ = upsampler.enhance(frame, outscale=self.scale)
        
        return output
    
    def upscale_video(
        self, 
        input_path: str, 
        output_path: str,
        progress_callback: Optional[callable] = None
    ) -> dict:
        """
        Upscale entire video.
        
        Args:
            input_path: Path to input video
            output_path: Path for output video
            progress_callback: Optional callback(current, total)
            
        Returns:
            dict with stats
        """
        import ffmpeg
        import time
        
        start_time = time.time()
        logger.info(f"[Upscaler] Starting {self.scale}x upscale")
        
        # Open input video
        cap = cv2.VideoCapture(input_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        new_width = width * self.scale
        new_height = height * self.scale
        
        logger.info(f"[Upscaler] {width}x{height} → {new_width}x{new_height}")
        logger.info(f"[Upscaler] {total_frames} frames @ {fps:.1f}fps")
        
        # Process frames
        frames = []
        frame_idx = 0
        
        pbar = tqdm(total=total_frames, desc=f"Upscaling {self.scale}x")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Upscale frame
            upscaled = self.upscale_frame(frame)
            frames.append(upscaled)
            
            frame_idx += 1
            pbar.update(1)
            
            if progress_callback:
                progress_callback(frame_idx, total_frames)
        
        pbar.close()
        cap.release()
        
        logger.info(f"[Upscaler] Encoding {len(frames)} upscaled frames")
        
        # Write output video
        temp_video = output_path + ".temp.mp4"
        
        process = (
            ffmpeg
            .input('pipe:', format='rawvideo', pix_fmt='bgr24', 
                   s=f'{new_width}x{new_height}', r=fps)
            .output(temp_video, pix_fmt='yuv420p', vcodec='libx264', 
                    preset='medium', crf=18)
            .overwrite_output()
            .run_async(pipe_stdin=True, quiet=True)
        )
        
        for frame in tqdm(frames, desc="Encoding"):
            process.stdin.write(frame.tobytes())
        
        process.stdin.close()
        process.wait()
        
        # Merge audio from original
        logger.info("[Upscaler] Merging audio track")
        try:
            video = ffmpeg.input(temp_video)
            audio = ffmpeg.input(input_path).audio
            
            (
                ffmpeg
                .output(video, audio, output_path, vcodec='copy', acodec='aac')
                .overwrite_output()
                .run(quiet=True)
            )
            
            os.remove(temp_video)
        except Exception as e:
            logger.warning(f"[Upscaler] Could not merge audio: {e}")
            os.rename(temp_video, output_path)
        
        total_time = time.time() - start_time
        
        logger.info(f"[Upscaler] ✅ Complete in {total_time:.1f}s")
        
        return {
            "scale": self.scale,
            "input_resolution": f"{width}x{height}",
            "output_resolution": f"{new_width}x{new_height}",
            "frames_processed": len(frames),
            "processing_time_s": round(total_time, 2),
            "fps": round(len(frames) / total_time, 2),
        }


def upscale_video_simple(
    input_path: str, 
    output_path: str, 
    scale: int = 2
) -> dict:
    """
    Simple function to upscale a video.
    
    Args:
        input_path: Input video path
        output_path: Output video path
        scale: Upscale factor (2 or 4)
        
    Returns:
        Processing stats
    """
    upscaler = VideoUpscaler(scale=scale)
    return upscaler.upscale_video(input_path, output_path)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python upscaler.py <input_video> <output_video> [scale]")
        print("Scale: 2 (default) or 4")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    
    result = upscale_video_simple(input_path, output_path, scale)
    print(f"Upscaling complete: {result}")
