"""
BlankLogo Watermark Detector
Uses YOLOv11 to detect watermark bounding boxes in video frames.
Inspired by SoraWatermarkCleaner.
"""
import os
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any

import numpy as np
from loguru import logger

# Lazy import to avoid loading YOLO until needed
_yolo_model = None

MODELS_DIR = Path(__file__).parent / "models"
YOLO_WEIGHTS_URL = "https://github.com/linkedlist771/SoraWatermarkCleaner/releases/download/V0.0.1/best.pt"


def get_device() -> str:
    """Get the best available device for inference."""
    import torch
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def download_weights(url: str, dest: Path) -> None:
    """Download model weights if not present."""
    if dest.exists():
        return
    
    logger.info(f"Downloading YOLO weights to {dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    
    import urllib.request
    urllib.request.urlretrieve(url, dest)
    logger.info("Download complete")


def get_yolo_model():
    """Lazy-load YOLO model."""
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        
        weights_path = MODELS_DIR / "watermark_detector.pt"
        download_weights(YOLO_WEIGHTS_URL, weights_path)
        
        logger.info(f"Loading YOLO model from {weights_path}")
        _yolo_model = YOLO(str(weights_path))
        _yolo_model.to(get_device())
        logger.info("YOLO model loaded")
    
    return _yolo_model


class WatermarkDetector:
    """Detects watermarks in video frames using YOLO."""
    
    def __init__(self, confidence_threshold: float = 0.5):
        self.model = get_yolo_model()
        self.confidence_threshold = confidence_threshold
    
    def detect_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Detect watermark in a single frame.
        
        Args:
            frame: BGR image as numpy array (H, W, 3)
            
        Returns:
            dict with keys:
                - detected: bool
                - bbox: (x1, y1, x2, y2) or None
                - confidence: float or None
                - center: (cx, cy) or None
        """
        results = self.model(frame, verbose=False)
        result = results[0]
        
        if len(result.boxes) == 0:
            return {
                "detected": False,
                "bbox": None,
                "confidence": None,
                "center": None
            }
        
        # Get highest confidence detection
        box = result.boxes[0]
        confidence = float(box.conf[0].cpu().numpy())
        
        if confidence < self.confidence_threshold:
            return {
                "detected": False,
                "bbox": None,
                "confidence": confidence,
                "center": None
            }
        
        xyxy = box.xyxy[0].cpu().numpy()
        x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        
        return {
            "detected": True,
            "bbox": (x1, y1, x2, y2),
            "confidence": confidence,
            "center": (cx, cy)
        }
    
    def detect_video(self, frames: List[np.ndarray]) -> List[Dict[str, Any]]:
        """
        Detect watermarks in all frames of a video.
        Fills in missed detections using interval averaging.
        
        Args:
            frames: List of BGR frames
            
        Returns:
            List of detection results, one per frame
        """
        from tqdm import tqdm
        
        results = []
        missed_indices = []
        bbox_centers = []
        
        # First pass: detect in all frames
        for idx, frame in enumerate(tqdm(frames, desc="Detecting watermarks")):
            detection = self.detect_frame(frame)
            results.append(detection)
            
            if detection["detected"]:
                bbox_centers.append(detection["center"])
            else:
                bbox_centers.append(None)
                missed_indices.append(idx)
        
        # Second pass: fill missed detections
        if missed_indices:
            results = self._fill_missed_detections(results, missed_indices)
        
        return results
    
    def _fill_missed_detections(
        self, 
        results: List[Dict[str, Any]], 
        missed_indices: List[int]
    ) -> List[Dict[str, Any]]:
        """Fill missed detections using neighbor interpolation."""
        for idx in missed_indices:
            # Try to get bbox from neighbors
            before_idx = idx - 1
            after_idx = idx + 1
            
            before_bbox = None
            after_bbox = None
            
            # Look backwards for valid bbox
            while before_idx >= 0:
                if results[before_idx]["detected"]:
                    before_bbox = results[before_idx]["bbox"]
                    break
                before_idx -= 1
            
            # Look forwards for valid bbox
            while after_idx < len(results):
                if results[after_idx]["detected"]:
                    after_bbox = results[after_idx]["bbox"]
                    break
                after_idx += 1
            
            # Use whichever neighbor is available
            if before_bbox:
                results[idx]["bbox"] = before_bbox
                results[idx]["detected"] = True
                results[idx]["interpolated"] = True
            elif after_bbox:
                results[idx]["bbox"] = after_bbox
                results[idx]["detected"] = True
                results[idx]["interpolated"] = True
        
        return results


if __name__ == "__main__":
    # Test detection
    import cv2
    
    detector = WatermarkDetector()
    
    # Test with a sample frame
    test_frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
    result = detector.detect_frame(test_frame)
    print(f"Detection result: {result}")
