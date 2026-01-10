#!/bin/bash
# RunPod Setup Script - Run this in the RunPod Web Terminal
# Pod: wvpr4vflxzj7po (RTX 3080)

set -e

echo "=============================================="
echo "BlankLogo LAMA GPU Setup"
echo "=============================================="

echo ""
echo "=== Checking GPU ==="
nvidia-smi --query-gpu=name,memory.total --format=csv

echo ""
echo "=== Installing dependencies ==="
pip install -q ultralytics loguru tqdm ffmpeg-python

echo ""
echo "=== Cloning BlankLogo ==="
cd /workspace
if [ -d "BlankLogo" ]; then
    cd BlankLogo && git pull
else
    git clone --depth 1 https://github.com/IsaiahDupree/BlankLogo.git
    cd BlankLogo
fi

cd apps/worker/python

echo ""
echo "=== Testing PyTorch CUDA ==="
python3 -c "
import torch
print(f'PyTorch: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB')
"

echo ""
echo "=== Downloading YOLO model ==="
python3 -c "from detector import get_yolo_model; get_yolo_model()"

echo ""
echo "=== Downloading LAMA model (196 MB) ==="
python3 -c "from inpainter import get_lama_model; m = get_lama_model(); print(f'LAMA loaded on: {m.get(\"device\", \"unknown\")}')"

echo ""
echo "=============================================="
echo "✅ Setup Complete!"
echo "=============================================="
echo ""
echo "To test watermark removal, run:"
echo "  cd /workspace/BlankLogo/apps/worker/python"
echo "  python3 server.py"
echo ""
echo "Then access at: http://localhost:8081/health"
