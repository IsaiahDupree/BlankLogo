"""
BlankLogo Video Processor
Main processing pipeline combining detection + inpainting.
"""
import os
import tempfile
from pathlib import Path
from typing import Optional, Callable
from enum import Enum

import numpy as np
import cv2
import ffmpeg
from loguru import logger
from tqdm import tqdm

from detector import WatermarkDetector
from inpainter import WatermarkInpainter
import time
from datetime import datetime


class ProcessingMode(str, Enum):
    """Watermark removal processing modes."""
    CROP = "crop"           # Fast FFmpeg crop (current)
    INPAINT = "inpaint"     # LAMA inpainting (quality)
    AUTO = "auto"           # Auto-detect watermark position + inpaint


class JobStatus:
    """Tracks and reports job progress."""
    
    def __init__(self, job_id: str = None):
        self.job_id = job_id or f"job_{int(time.time() * 1000)}"
        self.start_time = time.time()
        self.current_stage = "initializing"
        self.progress = 0
        self.total_frames = 0
        self.processed_frames = 0
        self.watermarks_detected = 0
        self.errors = []
        
    def log(self, message: str, level: str = "info"):
        """Log with job context."""
        elapsed = time.time() - self.start_time
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        prefix = f"[{timestamp}] [{self.job_id}] [{self.current_stage}]"
        
        if level == "info":
            logger.info(f"{prefix} {message}")
        elif level == "warn":
            logger.warning(f"{prefix} {message}")
        elif level == "error":
            logger.error(f"{prefix} {message}")
            self.errors.append(message)
        
        # Always print to console for visibility
        print(f"{prefix} {message}", flush=True)
    
    def update(self, stage: str = None, progress: int = None, message: str = None):
        """Update job status."""
        if stage:
            self.current_stage = stage
        if progress is not None:
            self.progress = progress
        if message:
            self.log(message)
    
    def frame_progress(self, current: int, total: int, extra: str = ""):
        """Report frame-by-frame progress."""
        self.processed_frames = current
        self.total_frames = total
        pct = int((current / total) * 100) if total > 0 else 0
        elapsed = time.time() - self.start_time
        fps = current / elapsed if elapsed > 0 else 0
        eta = (total - current) / fps if fps > 0 else 0
        
        msg = f"Frame {current}/{total} ({pct}%) | {fps:.1f} fps | ETA: {eta:.1f}s"
        if extra:
            msg += f" | {extra}"
        
        # Log every 10% or every 25 frames
        if current % max(1, total // 10) == 0 or current % 25 == 0 or current == total:
            self.log(msg)
    
    def summary(self) -> dict:
        """Get job summary."""
        elapsed = time.time() - self.start_time
        return {
            "job_id": self.job_id,
            "status": "completed" if not self.errors else "failed",
            "stage": self.current_stage,
            "progress": self.progress,
            "elapsed_seconds": round(elapsed, 2),
            "frames_processed": self.processed_frames,
            "total_frames": self.total_frames,
            "watermarks_detected": self.watermarks_detected,
            "fps": round(self.processed_frames / elapsed, 2) if elapsed > 0 else 0,
            "errors": self.errors,
        }


class VideoProcessor:
    """
    Main video processing pipeline.
    Supports multiple modes: crop (fast) and inpaint (quality).
    """
    
    def __init__(self, mode: ProcessingMode = ProcessingMode.CROP, job_id: str = None):
        self.mode = mode
        self._detector = None
        self._inpainter = None
        self.status = JobStatus(job_id)
    
    @property
    def detector(self) -> WatermarkDetector:
        """Lazy-load detector."""
        if self._detector is None:
            self._detector = WatermarkDetector()
        return self._detector
    
    @property
    def inpainter(self) -> WatermarkInpainter:
        """Lazy-load inpainter."""
        if self._inpainter is None:
            self._inpainter = WatermarkInpainter()
        return self._inpainter
    
    def load_video_frames(self, video_path: str) -> tuple:
        """
        Load all frames from a video.
        
        Returns:
            (frames, fps, width, height)
        """
        cap = cv2.VideoCapture(video_path)
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Loading video: {width}x{height} @ {fps}fps, {total_frames} frames")
        
        frames = []
        pbar = tqdm(total=total_frames, desc="Loading frames")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
            pbar.update(1)
        
        pbar.close()
        cap.release()
        
        return frames, fps, width, height
    
    def save_video_frames(
        self, 
        frames: list, 
        output_path: str, 
        fps: float,
        input_path: str
    ) -> None:
        """
        Save frames to video with FFmpeg, preserving audio from input.
        """
        if not frames:
            raise ValueError("No frames to save")
        
        height, width = frames[0].shape[:2]
        temp_video = output_path + ".temp.mp4"
        
        logger.info(f"Encoding {len(frames)} frames to video")
        
        # Write frames to temp file
        process = (
            ffmpeg
            .input('pipe:', format='rawvideo', pix_fmt='bgr24', s=f'{width}x{height}', r=fps)
            .output(temp_video, pix_fmt='yuv420p', vcodec='libx264', preset='medium', crf=18)
            .overwrite_output()
            .run_async(pipe_stdin=True, quiet=True)
        )
        
        for frame in tqdm(frames, desc="Writing frames"):
            process.stdin.write(frame.tobytes())
        
        process.stdin.close()
        process.wait()
        
        # Merge audio from original
        logger.info("Merging audio track")
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
            logger.warning(f"Could not merge audio: {e}, using video-only output")
            os.rename(temp_video, output_path)
        
        logger.info(f"Video saved to {output_path}")
    
    def process_crop(
        self, 
        input_path: str, 
        output_path: str,
        crop_pixels: int,
        crop_position: str = "bottom"
    ) -> dict:
        """
        Process video using simple FFmpeg crop (fast mode).
        """
        logger.info(f"Processing with crop mode: {crop_pixels}px from {crop_position}")
        
        # Get video dimensions
        probe = ffmpeg.probe(input_path)
        video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        width = int(video_info['width'])
        height = int(video_info['height'])
        
        # Build crop filter
        if crop_position == "bottom":
            crop_filter = f"crop={width}:{height - crop_pixels}:0:0"
        elif crop_position == "top":
            crop_filter = f"crop={width}:{height - crop_pixels}:0:{crop_pixels}"
        elif crop_position == "left":
            crop_filter = f"crop={width - crop_pixels}:{height}:{crop_pixels}:0"
        elif crop_position == "right":
            crop_filter = f"crop={width - crop_pixels}:{height}:0:0"
        else:
            crop_filter = f"crop={width}:{height - crop_pixels}:0:0"
        
        logger.info(f"Applying filter: {crop_filter}")
        
        # Run FFmpeg
        (
            ffmpeg
            .input(input_path)
            .output(output_path, vf=crop_filter, acodec='copy', movflags='+faststart')
            .overwrite_output()
            .run(quiet=True)
        )
        
        return {
            "mode": "crop",
            "crop_pixels": crop_pixels,
            "crop_position": crop_position,
            "original_size": (width, height),
            "output_size": (
                width - crop_pixels if crop_position in ["left", "right"] else width,
                height - crop_pixels if crop_position in ["top", "bottom"] else height
            )
        }
    
    def process_inpaint(
        self, 
        input_path: str, 
        output_path: str,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> dict:
        """
        Process video using YOLO detection + LAMA inpainting (quality mode).
        """
        self.status.update(stage="init", progress=0, message="Starting inpaint mode (YOLO + LAMA)")
        
        # Load frames
        self.status.update(stage="loading", progress=5, message="Loading video frames...")
        if progress_callback:
            progress_callback(5)
        
        frames, fps, width, height = self.load_video_frames(input_path)
        self.status.total_frames = len(frames)
        self.status.update(message=f"Loaded {len(frames)} frames ({width}x{height} @ {fps:.1f}fps)")
        
        if progress_callback:
            progress_callback(15)
        
        # Detect watermarks
        self.status.update(stage="detecting", progress=15, message="Detecting watermarks with YOLO...")
        detections = self.detector.detect_video(
            frames, 
            progress_callback=lambda i, n: self.status.frame_progress(i, n, "detection")
        )
        detected_count = sum(1 for d in detections if d["detected"])
        self.status.watermarks_detected = detected_count
        
        self.status.update(progress=40, message=f"Detected watermarks in {detected_count}/{len(frames)} frames")
        
        if progress_callback:
            progress_callback(40)
        
        # Inpaint frames
        if detected_count > 0:
            self.status.update(stage="inpainting", progress=45, message="Inpainting frames with LAMA...")
            inpainted_frames = self.inpainter.inpaint_video(
                frames, 
                detections,
                progress_callback=lambda i, n: self.status.frame_progress(i, n, "inpaint")
            )
        else:
            self.status.update(stage="skipped", message="No watermarks detected, returning original video")
            inpainted_frames = frames
        
        self.status.update(stage="encoding", progress=85, message="Encoding output video...")
        if progress_callback:
            progress_callback(85)
        
        # Save output
        self.save_video_frames(inpainted_frames, output_path, fps, input_path)
        
        self.status.update(stage="complete", progress=100, message="Processing complete!")
        if progress_callback:
            progress_callback(100)
        
        # Log summary
        summary = self.status.summary()
        self.status.log(f"SUMMARY: {summary['frames_processed']} frames, {summary['watermarks_detected']} watermarks, {summary['elapsed_seconds']}s ({summary['fps']} fps)")
        
        return {
            "mode": "inpaint",
            "job_id": self.status.job_id,
            "frames_processed": len(frames),
            "watermarks_detected": detected_count,
            "original_size": (width, height),
            "output_size": (width, height),
            "elapsed_seconds": summary["elapsed_seconds"],
            "fps": summary["fps"]
        }
    
    def process(
        self, 
        input_path: str, 
        output_path: str,
        crop_pixels: int = 100,
        crop_position: str = "bottom",
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> dict:
        """
        Main processing entry point.
        Chooses method based on self.mode.
        """
        if self.mode == ProcessingMode.CROP:
            return self.process_crop(input_path, output_path, crop_pixels, crop_position)
        elif self.mode in [ProcessingMode.INPAINT, ProcessingMode.AUTO]:
            return self.process_inpaint(input_path, output_path, progress_callback)
        else:
            raise ValueError(f"Unknown processing mode: {self.mode}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python processor.py <input_video> <output_video> [mode]")
        print("Modes: crop, inpaint, auto")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else "crop"
    
    processor = VideoProcessor(mode=ProcessingMode(mode))
    result = processor.process(input_path, output_path)
    
    print(f"Processing complete: {result}")
