#!/bin/bash
# Remove watermark from a video using the local inpaint service
# Usage: ./scripts/remove-watermark-local.sh <input_video> [output_dir]

INPUT_VIDEO="$1"
OUTPUT_DIR="${2:-$(dirname "$INPUT_VIDEO")}"
INPAINT_URL="${INPAINT_SERVICE_URL:-http://localhost:8000}"

if [ -z "$INPUT_VIDEO" ]; then
    echo "Usage: $0 <input_video> [output_dir]"
    exit 1
fi

if [ ! -f "$INPUT_VIDEO" ]; then
    echo "❌ Input video not found: $INPUT_VIDEO"
    exit 1
fi

BASENAME=$(basename "$INPUT_VIDEO" .mp4)
OUTPUT_CLEAN="${OUTPUT_DIR}/${BASENAME}_CLEAN.mp4"

echo "🎬 BlankLogo Watermark Remover"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 Input:  $INPUT_VIDEO"
echo "📤 Output: $OUTPUT_CLEAN"
echo "🔗 Service: $INPAINT_URL"
echo ""

# Check if inpaint service is running
echo "🔍 Checking inpaint service..."
if ! curl -s "${INPAINT_URL}/health" > /dev/null 2>&1; then
    echo "⚠️  Inpaint service not running at $INPAINT_URL"
    echo "   Starting local inpaint service..."
    cd "$(dirname "$0")/../apps/worker/python" && ./venv/bin/python main.py &
    INPAINT_PID=$!
    sleep 5
    
    if ! curl -s "${INPAINT_URL}/health" > /dev/null 2>&1; then
        echo "❌ Failed to start inpaint service"
        exit 1
    fi
fi

echo "✅ Inpaint service is running"
echo ""
echo "🚀 Processing video..."
echo ""

# Process the video
START_TIME=$(date +%s)

curl -X POST "${INPAINT_URL}/process" \
    -F "video=@${INPUT_VIDEO}" \
    -F "mode=inpaint" \
    -F "platform=sora" \
    -o "${OUTPUT_CLEAN}" \
    --progress-bar

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ -f "$OUTPUT_CLEAN" ] && [ -s "$OUTPUT_CLEAN" ]; then
    INPUT_SIZE=$(ls -lh "$INPUT_VIDEO" | awk '{print $5}')
    OUTPUT_SIZE=$(ls -lh "$OUTPUT_CLEAN" | awk '{print $5}')
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Watermark removed successfully!"
    echo ""
    echo "📊 Results:"
    echo "   Original:  $INPUT_VIDEO ($INPUT_SIZE)"
    echo "   Cleaned:   $OUTPUT_CLEAN ($OUTPUT_SIZE)"
    echo "   Duration:  ${DURATION}s"
    echo ""
    echo "🎉 Done! Open the cleaned video:"
    echo "   open \"$OUTPUT_CLEAN\""
else
    echo ""
    echo "❌ Failed to process video"
    exit 1
fi
