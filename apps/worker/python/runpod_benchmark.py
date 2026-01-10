"""
RunPod GPU Benchmark & Status Reporter

Tests LAMA inpainting performance on GPU vs CPU and reports
health, capabilities, and timing information.

Usage:
    python runpod_benchmark.py
"""
import os
import sys
import time
import json
import tempfile
import base64
from pathlib import Path
from datetime import datetime
from loguru import logger

# Configure logging
logger.remove()
logger.add(sys.stdout, format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}")


def get_system_info() -> dict:
    """Get system and GPU information."""
    import torch
    
    info = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "pytorch_version": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "mps_available": hasattr(torch.backends, "mps") and torch.backends.mps.is_available(),
    }
    
    if torch.cuda.is_available():
        info["cuda"] = {
            "device_count": torch.cuda.device_count(),
            "device_name": torch.cuda.get_device_name(0),
            "memory_total_gb": round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2),
            "memory_allocated_gb": round(torch.cuda.memory_allocated(0) / 1e9, 2),
            "memory_cached_gb": round(torch.cuda.memory_reserved(0) / 1e9, 2),
        }
        info["device"] = "cuda"
    elif info["mps_available"]:
        info["device"] = "mps"
    else:
        info["device"] = "cpu"
    
    return info


def get_model_status() -> dict:
    """Check model download and load status."""
    import torch
    from pathlib import Path
    
    status = {
        "yolo": {"status": "unknown", "path": None, "loaded": False},
        "lama": {"status": "unknown", "path": None, "loaded": False},
    }
    
    # Check YOLO
    yolo_path = Path(__file__).parent / "models" / "watermark_detector.pt"
    status["yolo"]["path"] = str(yolo_path)
    status["yolo"]["status"] = "downloaded" if yolo_path.exists() else "not_downloaded"
    
    # Check LAMA
    try:
        hub_dir = torch.hub.get_dir()
        lama_path = os.path.join(hub_dir, "checkpoints", "big-lama.pt")
        status["lama"]["path"] = lama_path
        status["lama"]["status"] = "downloaded" if os.path.exists(lama_path) else "not_downloaded"
    except Exception as e:
        status["lama"]["status"] = f"error: {e}"
    
    return status


def benchmark_inpainting(use_gpu: bool = True, num_frames: int = 10) -> dict:
    """Benchmark inpainting performance."""
    import numpy as np
    import torch
    
    logger.info(f"Benchmarking {'GPU' if use_gpu else 'CPU'} with {num_frames} frames...")
    
    # Force device
    original_cuda = torch.cuda.is_available
    if not use_gpu:
        torch.cuda.is_available = lambda: False
    
    try:
        from inpainter import WatermarkInpainter
        
        # Create test frame and mask
        frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
        mask = np.zeros((720, 1280), dtype=np.uint8)
        mask[650:700, 500:780] = 255  # Simulate watermark region
        
        # Initialize inpainter
        init_start = time.time()
        inpainter = WatermarkInpainter()
        init_time = time.time() - init_start
        
        # Warm-up
        logger.info("Warm-up run...")
        _ = inpainter.inpaint_frame(frame, mask)
        
        # Benchmark
        logger.info(f"Running {num_frames} frames...")
        times = []
        for i in range(num_frames):
            start = time.time()
            result = inpainter.inpaint_frame(frame, mask)
            elapsed = time.time() - start
            times.append(elapsed)
            logger.info(f"  Frame {i+1}/{num_frames}: {elapsed:.3f}s")
        
        avg_time = sum(times) / len(times)
        fps = 1.0 / avg_time if avg_time > 0 else 0
        
        return {
            "device": "gpu" if use_gpu and torch.cuda.is_available() else "cpu",
            "num_frames": num_frames,
            "init_time_s": round(init_time, 3),
            "avg_frame_time_s": round(avg_time, 3),
            "fps": round(fps, 2),
            "total_time_s": round(sum(times), 3),
            "times": [round(t, 3) for t in times],
            "backend": "lama" if not inpainter.use_fallback else "opencv",
        }
    finally:
        torch.cuda.is_available = original_cuda


def run_health_check() -> dict:
    """Run comprehensive health check."""
    logger.info("=" * 60)
    logger.info("Running Health Check...")
    logger.info("=" * 60)
    
    health = {
        "status": "healthy",
        "checks": {},
        "errors": [],
    }
    
    # Check 1: System info
    try:
        health["system"] = get_system_info()
        health["checks"]["system_info"] = "pass"
        logger.info(f"✅ System: {health['system']['device'].upper()}")
    except Exception as e:
        health["checks"]["system_info"] = "fail"
        health["errors"].append(f"system_info: {e}")
        health["status"] = "degraded"
        logger.error(f"❌ System info: {e}")
    
    # Check 2: Model status
    try:
        health["models"] = get_model_status()
        health["checks"]["models"] = "pass"
        logger.info(f"✅ YOLO: {health['models']['yolo']['status']}")
        logger.info(f"✅ LAMA: {health['models']['lama']['status']}")
    except Exception as e:
        health["checks"]["models"] = "fail"
        health["errors"].append(f"models: {e}")
        health["status"] = "degraded"
        logger.error(f"❌ Model check: {e}")
    
    # Check 3: YOLO load
    try:
        from detector import get_yolo_model
        start = time.time()
        get_yolo_model()
        load_time = time.time() - start
        health["checks"]["yolo_load"] = "pass"
        health["models"]["yolo"]["loaded"] = True
        health["models"]["yolo"]["load_time_s"] = round(load_time, 3)
        logger.info(f"✅ YOLO loaded in {load_time:.2f}s")
    except Exception as e:
        health["checks"]["yolo_load"] = "fail"
        health["errors"].append(f"yolo_load: {e}")
        health["status"] = "unhealthy"
        logger.error(f"❌ YOLO load: {e}")
    
    # Check 4: LAMA load
    try:
        from inpainter import get_lama_model
        start = time.time()
        model = get_lama_model()
        load_time = time.time() - start
        health["checks"]["lama_load"] = "pass"
        health["models"]["lama"]["loaded"] = True
        health["models"]["lama"]["load_time_s"] = round(load_time, 3)
        health["models"]["lama"]["device"] = model.get("device", "unknown")
        logger.info(f"✅ LAMA loaded on {model.get('device', 'unknown')} in {load_time:.2f}s")
    except Exception as e:
        health["checks"]["lama_load"] = "fail"
        health["errors"].append(f"lama_load: {e}")
        health["status"] = "degraded"  # Can fall back to OpenCV
        logger.error(f"❌ LAMA load: {e}")
    
    return health


def run_benchmark() -> dict:
    """Run full benchmark suite."""
    logger.info("=" * 60)
    logger.info("Running Performance Benchmark...")
    logger.info("=" * 60)
    
    results = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "benchmarks": {},
    }
    
    # GPU benchmark (if available)
    import torch
    if torch.cuda.is_available():
        logger.info("")
        logger.info("--- GPU Benchmark ---")
        results["benchmarks"]["gpu"] = benchmark_inpainting(use_gpu=True, num_frames=5)
        logger.info(f"GPU: {results['benchmarks']['gpu']['fps']:.2f} FPS")
    
    # CPU benchmark
    logger.info("")
    logger.info("--- CPU Benchmark ---")
    results["benchmarks"]["cpu"] = benchmark_inpainting(use_gpu=False, num_frames=3)
    logger.info(f"CPU: {results['benchmarks']['cpu']['fps']:.2f} FPS")
    
    # Calculate speedup
    if "gpu" in results["benchmarks"] and "cpu" in results["benchmarks"]:
        gpu_fps = results["benchmarks"]["gpu"]["fps"]
        cpu_fps = results["benchmarks"]["cpu"]["fps"]
        if cpu_fps > 0:
            results["speedup"] = round(gpu_fps / cpu_fps, 2)
            logger.info("")
            logger.info(f"🚀 GPU Speedup: {results['speedup']}x faster than CPU")
    
    return results


def get_capabilities() -> dict:
    """Get service capabilities."""
    import torch
    
    return {
        "service": "blanklogo-inpainter-gpu",
        "version": "1.0.0",
        "capabilities": {
            "modes": ["crop", "inpaint", "auto"],
            "supported_formats": ["mp4", "mov", "webm", "avi"],
            "max_file_size_mb": 500,
            "max_duration_sec": 300,
        },
        "features": {
            "gpu_acceleration": torch.cuda.is_available(),
            "async_processing": True,
            "auto_scaling": True,
        },
        "runtime": {
            "device": "cuda" if torch.cuda.is_available() else "cpu",
            "torch_version": torch.__version__,
        },
    }


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="RunPod Benchmark & Status")
    parser.add_argument("--health", action="store_true", help="Run health check only")
    parser.add_argument("--benchmark", action="store_true", help="Run benchmark only")
    parser.add_argument("--capabilities", action="store_true", help="Show capabilities only")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()
    
    results = {}
    
    if args.capabilities:
        results = get_capabilities()
    elif args.health:
        results = run_health_check()
    elif args.benchmark:
        results = run_benchmark()
    else:
        # Run everything
        results["health"] = run_health_check()
        results["benchmark"] = run_benchmark()
        results["capabilities"] = get_capabilities()
    
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        logger.info("")
        logger.info("=" * 60)
        logger.info("SUMMARY")
        logger.info("=" * 60)
        
        if "health" in results:
            logger.info(f"Health Status: {results['health']['status'].upper()}")
            logger.info(f"Device: {results['health'].get('system', {}).get('device', 'unknown').upper()}")
        
        if "benchmark" in results:
            if "gpu" in results["benchmark"].get("benchmarks", {}):
                gpu = results["benchmark"]["benchmarks"]["gpu"]
                logger.info(f"GPU Performance: {gpu['fps']:.2f} FPS ({gpu['avg_frame_time_s']*1000:.0f}ms/frame)")
            if "speedup" in results["benchmark"]:
                logger.info(f"GPU Speedup: {results['benchmark']['speedup']}x")
        
        logger.info("")
        logger.info("✅ All checks complete!")


if __name__ == "__main__":
    main()
