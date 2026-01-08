#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# BlankLogo Watermark Removal Benchmark
# Compares local vs deployed processing time
# ═══════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Config
TEST_VIDEO="${1:-test-videos/sora-watermark-test.mp4}"
DEPLOYED_API="https://blanklogo-api.onrender.com"
DEPLOYED_INPAINT="https://blanklogo-inpaint.onrender.com"
LOCAL_API="http://localhost:8989"
LOCAL_INPAINT="http://localhost:10000"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     BlankLogo Watermark Removal Benchmark                         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check test video exists
if [ ! -f "$TEST_VIDEO" ]; then
    echo -e "${RED}❌ Test video not found: $TEST_VIDEO${NC}"
    exit 1
fi

VIDEO_SIZE=$(ls -lh "$TEST_VIDEO" | awk '{print $5}')
echo -e "Test Video: ${CYAN}$TEST_VIDEO${NC} ($VIDEO_SIZE)"
echo ""

# Get video info
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$TEST_VIDEO" 2>/dev/null | cut -d. -f1)
FRAMES=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$TEST_VIDEO" 2>/dev/null)
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "$TEST_VIDEO" 2>/dev/null)

echo -e "Duration: ${CYAN}${DURATION}s${NC}"
echo -e "Frames:   ${CYAN}${FRAMES:-unknown}${NC}"
echo -e "FPS:      ${CYAN}${FPS}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════
# LOCAL BENCHMARK
# ═══════════════════════════════════════════════════════════════════
echo -e "${YELLOW}━━━ Local Benchmark ━━━${NC}"

# Check if local services are running
LOCAL_AVAILABLE=false
if curl -s --max-time 2 "$LOCAL_INPAINT/health" > /dev/null 2>&1; then
    LOCAL_AVAILABLE=true
    echo -e "Local Inpaint: ${GREEN}✓ Available${NC}"
else
    echo -e "Local Inpaint: ${RED}✗ Not running${NC}"
fi

if [ "$LOCAL_AVAILABLE" = true ]; then
    echo "Running local benchmark..."
    
    LOCAL_START=$(date +%s.%N)
    
    # Call local inpaint service directly
    LOCAL_RESULT=$(curl -s -X POST "$LOCAL_INPAINT/process" \
        -H "Content-Type: multipart/form-data" \
        -F "video=@$TEST_VIDEO" \
        -F "mode=inpaint" \
        -F "platform=sora" \
        -w "\n%{time_total}" 2>&1)
    
    LOCAL_END=$(date +%s.%N)
    LOCAL_TIME=$(echo "$LOCAL_END - $LOCAL_START" | bc)
    
    echo -e "Local Processing Time: ${GREEN}${LOCAL_TIME}s${NC}"
else
    echo -e "${YELLOW}⚠ Skipping local benchmark (services not running)${NC}"
    LOCAL_TIME="N/A"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# DEPLOYED BENCHMARK
# ═══════════════════════════════════════════════════════════════════
echo -e "${YELLOW}━━━ Deployed Benchmark ━━━${NC}"

# Check deployed services
DEPLOYED_AVAILABLE=false
if curl -s --max-time 5 "$DEPLOYED_INPAINT/health" > /dev/null 2>&1; then
    DEPLOYED_AVAILABLE=true
    echo -e "Deployed Inpaint: ${GREEN}✓ Available${NC}"
else
    echo -e "Deployed Inpaint: ${RED}✗ Not available${NC}"
fi

if [ "$DEPLOYED_AVAILABLE" = true ]; then
    echo "Running deployed benchmark..."
    
    DEPLOYED_START=$(date +%s.%N)
    
    # Call deployed inpaint service directly
    DEPLOYED_RESULT=$(curl -s -X POST "$DEPLOYED_INPAINT/process" \
        -H "Content-Type: multipart/form-data" \
        -F "video=@$TEST_VIDEO" \
        -F "mode=inpaint" \
        -F "platform=sora" \
        -w "\n%{time_total}" 2>&1)
    
    DEPLOYED_END=$(date +%s.%N)
    DEPLOYED_TIME=$(echo "$DEPLOYED_END - $DEPLOYED_START" | bc)
    
    echo -e "Deployed Processing Time: ${GREEN}${DEPLOYED_TIME}s${NC}"
else
    echo -e "${YELLOW}⚠ Skipping deployed benchmark (services not available)${NC}"
    DEPLOYED_TIME="N/A"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Benchmark Results ━━━${NC}"
echo ""
echo "Test Video: $TEST_VIDEO ($VIDEO_SIZE)"
echo "Duration: ${DURATION}s | Frames: ${FRAMES:-unknown}"
echo ""
echo "┌───────────────┬─────────────────┬──────────────┐"
echo "│ Environment   │ Processing Time │ Speed        │"
echo "├───────────────┼─────────────────┼──────────────┤"

if [ "$LOCAL_TIME" != "N/A" ]; then
    LOCAL_SPEED=$(echo "scale=2; $DURATION / $LOCAL_TIME" | bc 2>/dev/null || echo "N/A")
    printf "│ %-13s │ %15s │ %10sx │\n" "Local" "${LOCAL_TIME}s" "$LOCAL_SPEED"
else
    printf "│ %-13s │ %15s │ %12s │\n" "Local" "N/A" "N/A"
fi

if [ "$DEPLOYED_TIME" != "N/A" ]; then
    DEPLOYED_SPEED=$(echo "scale=2; $DURATION / $DEPLOYED_TIME" | bc 2>/dev/null || echo "N/A")
    printf "│ %-13s │ %15s │ %10sx │\n" "Deployed" "${DEPLOYED_TIME}s" "$DEPLOYED_SPEED"
else
    printf "│ %-13s │ %15s │ %12s │\n" "Deployed" "N/A" "N/A"
fi

echo "└───────────────┴─────────────────┴──────────────┘"
echo ""

# Comparison
if [ "$LOCAL_TIME" != "N/A" ] && [ "$DEPLOYED_TIME" != "N/A" ]; then
    RATIO=$(echo "scale=2; $DEPLOYED_TIME / $LOCAL_TIME" | bc 2>/dev/null || echo "N/A")
    echo -e "Deployed is ${CYAN}${RATIO}x${NC} slower than local"
fi

echo ""
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
