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


class ProcessingMode(str, Enum):
    """Watermark removal processing modes."""
    CROP = "crop"           # Fast FFmpeg crop (current)
    INPAINT = "inpaint"     # LAMA inpainting (quality)
    AUTO = "auto"           # Auto-detect watermark position + inpaint


class VideoProcessor:
    """
    Main video processing pipeline.
    Supports multiple modes: crop (fast) and inpaint (quality).
    """
    
    def __init__(self, mode: ProcessingMode = ProcessingMode.CROP):
        self.mode = mode
        self._detector = None
        self._inpainter = None
    
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
        logger.info("Processing with inpaint mode (YOLO + LAMA)")
        
        # Load frames
        if progress_callback:
            progress_callback(5)
        
        frames, fps, width, height = self.load_video_frames(input_path)
        
        if progress_callback:
            progress_callback(20)
        
        # Detect watermarks
        detections = self.detector.detect_video(frames)
        detected_count = sum(1 for d in detections if d["detected"])
        
        logger.info(f"Detected watermarks in {detected_count}/{len(frames)} frames")
        
        if progress_callback:
            progress_callback(50)
        
        # Inpaint frames
        if detected_count > 0:
            inpainted_frames = self.inpainter.inpaint_video(frames, detections)
        else:
            logger.warning("No watermarks detected, returning original video")
            inpainted_frames = frames
        
        if progress_callback:
            progress_callback(85)
        
        # Save output
        self.save_video_frames(inpainted_frames, output_path, fps, input_path)
        
        if progress_callback:
            progress_callback(100)
        
        return {
            "mode": "inpaint",
            "frames_processed": len(frames),
            "watermarks_detected": detected_count,
            "original_size": (width, height),
            "output_size": (width, height)  # Inpainting preserves dimensions
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
