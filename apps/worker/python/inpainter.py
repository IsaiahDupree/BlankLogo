"""
BlankLogo Watermark Inpainter
Uses LAMA model to inpaint (remove) watermark regions.
Inspired by SoraWatermarkCleaner and IOPaint.
"""
import os
from pathlib import Path
from typing import Optional, List

import numpy as np
from loguru import logger

# Lazy imports
_lama_model = None


def get_device() -> str:
    """Get the best available device for inference."""
    import torch
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def get_lama_model():
    """Lazy-load LAMA model via simple-lama-inpainting."""
    global _lama_model
    if _lama_model is None:
        try:
            from simple_lama_inpainting import SimpleLama
            import torch
            
            # Determine best device - MPS for Apple Silicon, CPU otherwise
            if torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"
            
            logger.info(f"Loading LAMA model on {device}")
            
            # SimpleLama needs to be loaded without CUDA tensors
            with torch.device(device):
                _lama_model = {
                    "model": SimpleLama(device=device),
                    "device": device
                }
            logger.info("LAMA model loaded successfully")
        except Exception as e:
            logger.warning(f"simple-lama-inpainting failed ({e}), using fallback inpainting")
            _lama_model = {"fallback": True}
    
    return _lama_model


class WatermarkInpainter:
    """Inpaints (removes) watermarks from video frames using LAMA."""
    
    def __init__(self):
        self.model = get_lama_model()
        self.use_fallback = self.model.get("fallback", False)
    
    def create_mask(
        self, 
        frame_shape: tuple, 
        bbox: tuple,
        padding: int = 15  # Increased from 5 for better coverage
    ) -> np.ndarray:
        """
        Create a binary mask from a bounding box.
        
        Args:
            frame_shape: (H, W) or (H, W, C)
            bbox: (x1, y1, x2, y2)
            padding: Extra pixels around bbox
            
        Returns:
            Binary mask (H, W) with 255 in watermark region
        """
        h, w = frame_shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)
        
        x1, y1, x2, y2 = bbox
        # Add padding
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(w, x2 + padding)
        y2 = min(h, y2 + padding)
        
        mask[y1:y2, x1:x2] = 255
        return mask
    
    def inpaint_frame(
        self, 
        frame: np.ndarray, 
        mask: np.ndarray
    ) -> np.ndarray:
        """
        Inpaint a single frame using LAMA.
        
        Args:
            frame: BGR image (H, W, 3)
            mask: Binary mask (H, W) with 255 in regions to inpaint
            
        Returns:
            Inpainted BGR image
        """
        if self.use_fallback:
            return self._fallback_inpaint(frame, mask)
        
        import cv2
        from PIL import Image
        
        # simple-lama-inpainting expects PIL Images
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img_pil = Image.fromarray(frame_rgb)
        mask_pil = Image.fromarray(mask)
        
        # Run inpainting
        result_pil = self.model["model"](img_pil, mask_pil)
        
        # Convert back to numpy BGR
        result_rgb = np.array(result_pil)
        result_bgr = cv2.cvtColor(result_rgb, cv2.COLOR_RGB2BGR)
        return result_bgr
    
    def _fallback_inpaint(
        self, 
        frame: np.ndarray, 
        mask: np.ndarray
    ) -> np.ndarray:
        """
        Enhanced fallback inpainting using OpenCV.
        Uses Navier-Stokes with larger radius and mask processing for better quality.
        """
        import cv2
        
        # Dilate mask for smoother edges (covers more of the watermark)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        mask_dilated = cv2.dilate(mask, kernel, iterations=2)
        
        # Use Navier-Stokes based inpainting (better for larger areas)
        # Increase inpaint radius for smoother results
        result = cv2.inpaint(frame, mask_dilated, 7, cv2.INPAINT_NS)
        
        # Optional: Apply slight Gaussian blur to blend edges
        # Create a blurred version for edge blending
        mask_blur = cv2.GaussianBlur(mask_dilated.astype(np.float32), (15, 15), 0)
        mask_blur = (mask_blur / 255.0).astype(np.float32)
        
        # Blend inpainted region with slight blur for smoother transition
        mask_3ch = np.stack([mask_blur] * 3, axis=-1)
        blurred = cv2.GaussianBlur(result, (5, 5), 0)
        result = (result * (1 - mask_3ch * 0.3) + blurred * (mask_3ch * 0.3)).astype(np.uint8)
        
        return result
    
    def inpaint_video(
        self, 
        frames: List[np.ndarray], 
        detections: List[dict]
    ) -> List[np.ndarray]:
        """
        Inpaint all frames of a video.
        
        Args:
            frames: List of BGR frames
            detections: List of detection results from WatermarkDetector
            
        Returns:
            List of inpainted frames
        """
        from tqdm import tqdm
        
        results = []
        
        for idx, (frame, detection) in enumerate(
            tqdm(zip(frames, detections), total=len(frames), desc="Inpainting frames")
        ):
            if detection["detected"] and detection["bbox"]:
                mask = self.create_mask(frame.shape, detection["bbox"])
                inpainted = self.inpaint_frame(frame, mask)
                results.append(inpainted)
            else:
                # No watermark detected, keep original
                results.append(frame)
        
        return results


if __name__ == "__main__":
    # Test inpainting
    import cv2
    
    inpainter = WatermarkInpainter()
    
    # Test with a sample frame
    test_frame = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)
    test_mask = np.zeros((1080, 1920), dtype=np.uint8)
    test_mask[900:1000, 800:1100] = 255  # Simulated watermark region
    
    result = inpainter.inpaint_frame(test_frame, test_mask)
    print(f"Inpainting complete, output shape: {result.shape}")
