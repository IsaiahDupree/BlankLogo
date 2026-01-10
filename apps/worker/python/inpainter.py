"""
BlankLogo Watermark Inpainter
Uses LAMA model to inpaint (remove) watermark regions.
Based on IOPaint/SoraWatermarkCleaner implementation.
"""
import os
import hashlib
from pathlib import Path
from typing import Optional, List
from urllib.parse import urlparse

import numpy as np
from loguru import logger

# Lazy imports
_lama_model = None

# LAMA model from IOPaint (works on CPU/MPS/CUDA)
LAMA_MODEL_URL = "https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt"
LAMA_MODEL_MD5 = "e3aa4aaa15225a33ec84f9f4bc47e500"


def get_device() -> str:
    """Get the best available device for inference."""
    import torch
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def md5sum(filename: str) -> str:
    """Calculate MD5 checksum of a file."""
    md5 = hashlib.md5()
    with open(filename, "rb") as f:
        for chunk in iter(lambda: f.read(128 * md5.block_size), b""):
            md5.update(chunk)
    return md5.hexdigest()


def download_lama_model(url: str, model_md5: str) -> str:
    """Download LAMA model if not present. Returns path to model."""
    import torch
    from torch.hub import download_url_to_file, get_dir
    
    # Get cache path
    parts = urlparse(url)
    hub_dir = get_dir()
    model_dir = os.path.join(hub_dir, "checkpoints")
    os.makedirs(model_dir, exist_ok=True)
    filename = os.path.basename(parts.path)
    cached_file = os.path.join(model_dir, filename)
    
    # Download if not exists
    if not os.path.exists(cached_file):
        logger.info(f"Downloading LAMA model to {cached_file}")
        download_url_to_file(url, cached_file, None, progress=True)
        
        # Verify MD5
        _md5 = md5sum(cached_file)
        if _md5 != model_md5:
            os.remove(cached_file)
            raise RuntimeError(f"Model MD5 mismatch: {_md5} != {model_md5}")
        logger.info(f"LAMA model downloaded, MD5 verified: {_md5}")
    
    return cached_file


def get_lama_model():
    """Lazy-load LAMA model using IOPaint's big-lama.pt."""
    global _lama_model
    if _lama_model is None:
        try:
            import torch
            
            device = get_device()
            logger.info(f"Loading LAMA model on {device}")
            
            # Download model if needed
            model_path = download_lama_model(LAMA_MODEL_URL, LAMA_MODEL_MD5)
            
            # Load JIT model (map to CPU first, then move to device)
            model = torch.jit.load(model_path, map_location="cpu").to(device)
            model.eval()
            
            _lama_model = {
                "model": model,
                "device": device,
                "type": "big-lama"
            }
            logger.info(f"LAMA model loaded successfully on {device}")
        except Exception as e:
            logger.warning(f"LAMA model failed to load ({e}), using fallback inpainting")
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
    
    def _norm_img(self, img: np.ndarray) -> np.ndarray:
        """Normalize image to [0, 1] float32 and add channel dim if needed."""
        if img.dtype == np.uint8:
            img = img.astype(np.float32) / 255.0
        if len(img.shape) == 2:
            img = img[:, :, np.newaxis]
        if img.shape[2] == 1:
            img = np.repeat(img, 3, axis=2)
        return img
    
    def _pad_to_mod(self, img: np.ndarray, mod: int = 8) -> tuple:
        """Pad image to be divisible by mod. Returns (padded_img, original_shape)."""
        h, w = img.shape[:2]
        pad_h = (mod - h % mod) % mod
        pad_w = (mod - w % mod) % mod
        
        if pad_h > 0 or pad_w > 0:
            img = np.pad(img, ((0, pad_h), (0, pad_w), (0, 0)), mode='reflect')
        
        return img, (h, w)
    
    def inpaint_frame(
        self, 
        frame: np.ndarray, 
        mask: np.ndarray
    ) -> np.ndarray:
        """
        Inpaint a single frame using LAMA (big-lama.pt from IOPaint).
        
        Args:
            frame: BGR image (H, W, 3)
            mask: Binary mask (H, W) with 255 in regions to inpaint
            
        Returns:
            Inpainted BGR image
        """
        if self.use_fallback:
            return self._fallback_inpaint(frame, mask)
        
        import cv2
        import torch
        
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Normalize to [0, 1]
        image = self._norm_img(frame_rgb)  # [H, W, 3]
        mask_norm = self._norm_img(mask)    # [H, W, 1] -> [H, W, 3]
        mask_norm = mask_norm[:, :, 0:1]    # Keep single channel [H, W, 1]
        
        # Pad to multiple of 8 (LAMA requirement)
        image_padded, orig_shape = self._pad_to_mod(image, 8)
        mask_padded, _ = self._pad_to_mod(mask_norm, 8)
        
        # Convert to torch tensors [B, C, H, W]
        device = self.model["device"]
        mask_binary = (mask_padded > 0).astype(np.float32)
        
        image_tensor = torch.from_numpy(image_padded).permute(2, 0, 1).unsqueeze(0).to(device)
        mask_tensor = torch.from_numpy(mask_binary).permute(2, 0, 1).unsqueeze(0).to(device)
        
        # Run LAMA inference
        with torch.inference_mode():
            result = self.model["model"](image_tensor, mask_tensor)
        
        # Convert back to numpy
        result_np = result[0].permute(1, 2, 0).cpu().numpy()
        
        # Crop to original size
        h, w = orig_shape
        result_np = result_np[:h, :w, :]
        
        # Convert to uint8 BGR
        result_np = np.clip(result_np * 255, 0, 255).astype(np.uint8)
        result_bgr = cv2.cvtColor(result_np, cv2.COLOR_RGB2BGR)
        
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
