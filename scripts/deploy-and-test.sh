#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# BlankLogo Deploy and Test Script
# 
# Runs deployment health check followed by golden path tests
# This is the STANDARD post-deployment verification workflow
# ═══════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# URLs
WEB_URL="https://www.blanklogo.app"
API_URL="https://blanklogo-api.onrender.com"
INPAINT_URL="https://blanklogo-inpaint.onrender.com"

# Test credentials (set via environment or use defaults)
TEST_EMAIL="${TEST_USER_EMAIL:-isaiahdupree33@gmail.com}"
TEST_PASSWORD="${TEST_USER_PASSWORD:-Frogger12}"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     BlankLogo Deploy & Test Pipeline                              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Web:     $WEB_URL"
echo "  API:     $API_URL"
echo "  Inpaint: $INPAINT_URL"
echo "  Time:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 1: Health Check
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Step 1: Health Check ━━━${NC}"
echo ""

HEALTH_PASSED=0
HEALTH_FAILED=0

check_health() {
    local name=$1
    local url=$2
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        echo -e "  ${GREEN}✓${NC} $name"
        ((HEALTH_PASSED++))
    else
        echo -e "  ${RED}✗${NC} $name (HTTP $status)"
        ((HEALTH_FAILED++))
    fi
}

check_health "Web App" "$WEB_URL"
check_health "API Health" "$API_URL/health"
check_health "Inpaint Health" "$INPAINT_URL/health"
check_health "API Status" "$API_URL/status"

echo ""
echo "Health Check: $HEALTH_PASSED passed, $HEALTH_FAILED failed"

if [ $HEALTH_FAILED -gt 0 ]; then
    echo -e "${RED}Health check failed! Aborting tests.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All services healthy${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 2: Wait for deployment to stabilize
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Step 2: Waiting for deployment to stabilize (10s) ━━━${NC}"
sleep 10
echo ""

# ═══════════════════════════════════════════════════════════════════
# STEP 3: Golden Path Tests
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Step 3: Golden Path Upload Tests ━━━${NC}"
echo ""
echo "Running full golden path tests with video upload..."
echo ""

SKIP_HEALTH_CHECK=1 \
BASE_URL="$WEB_URL" \
DEPLOY_WEB_URL="$WEB_URL" \
TEST_USER_EMAIL="$TEST_EMAIL" \
TEST_USER_PASSWORD="$TEST_PASSWORD" \
npx playwright test tests/deployment/golden-path-upload.spec.ts \
    --project=deployment \
    --timeout=60000 \
    --reporter=list 2>&1 | grep -E "✓|✗|passed|failed|\[Golden|\[API|\[Queue|\[Inpaint"

GOLDEN_PATH_EXIT=$?

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Summary ━━━${NC}"
echo ""

if [ $GOLDEN_PATH_EXIT -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ DEPLOYMENT VERIFIED - All tests passed!                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ DEPLOYMENT TESTS FAILED - Check output above                  ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
