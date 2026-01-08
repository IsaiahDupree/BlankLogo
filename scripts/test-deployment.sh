#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# BlankLogo Production Deployment Test Suite
# Tests all endpoints on Render + Vercel
# ═══════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Production URLs
WEB_URL="https://www.blanklogo.app"
API_URL="https://blanklogo-api.onrender.com"
INPAINT_URL="https://blanklogo-inpaint.onrender.com"

# Timeout (15 seconds per request)
TIMEOUT=15

# Counters
PASSED=0
FAILED=0
TOTAL=0

log_test() {
    local status=$1
    local name=$2
    local details=$3
    ((TOTAL++))
    
    if [ "$status" = "pass" ]; then
        echo -e "  ${GREEN}✓${NC} $name ${details:+- $details}"
        ((PASSED++))
    else
        echo -e "  ${RED}✗${NC} $name ${details:+- $details}"
        ((FAILED++))
    fi
}

test_endpoint() {
    local name=$1
    local url=$2
    local expected=${3:-200}
    
    local start=$(date +%s%N)
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
    local end=$(date +%s%N)
    local ms=$(( (end - start) / 1000000 ))
    
    if [ "$status" = "$expected" ]; then
        log_test "pass" "$name" "HTTP $status in ${ms}ms"
    else
        log_test "fail" "$name" "HTTP $status (expected $expected)"
    fi
}

test_json_field() {
    local name=$1
    local url=$2
    local field=$3
    local expected=$4
    
    local response=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null)
    local value=$(echo "$response" | jq -r "$field" 2>/dev/null)
    
    if [ "$value" = "$expected" ]; then
        log_test "pass" "$name" "$field=$value"
    else
        log_test "fail" "$name" "$field=$value (expected $expected)"
    fi
}

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     BlankLogo Production Deployment Test Suite                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Web:     $WEB_URL"
echo "  API:     $API_URL"
echo "  Inpaint: $INPAINT_URL"
echo "  Time:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# ═══════════════════════════════════════════════════════════════════
# VERCEL WEB APP TESTS
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Vercel Web App ($WEB_URL) ━━━${NC}"
echo ""
echo "Public Pages:"
test_endpoint "Homepage" "$WEB_URL"
test_endpoint "Login page" "$WEB_URL/login"
test_endpoint "Signup page" "$WEB_URL/signup"
test_endpoint "Pricing page" "$WEB_URL/pricing"
test_endpoint "Forgot password" "$WEB_URL/forgot-password"

echo ""
echo "API Routes:"
test_endpoint "Pixel test endpoint" "$WEB_URL/api/test/pixel"
test_endpoint "Health check" "$WEB_URL/api/health" "404"

echo ""

# ═══════════════════════════════════════════════════════════════════
# RENDER API TESTS
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Render API ($API_URL) ━━━${NC}"
echo ""
echo "Health Endpoints:"
test_endpoint "Health" "$API_URL/health"
test_endpoint "Healthz (liveness)" "$API_URL/healthz"
test_endpoint "Readyz (readiness)" "$API_URL/readyz"
test_endpoint "Status" "$API_URL/status"
test_endpoint "Diagnostics" "$API_URL/diagnostics"

echo ""
echo "Health Status Checks:"
test_json_field "API status healthy" "$API_URL/health" ".status" "healthy"
test_json_field "Redis connected" "$API_URL/health" ".services.redis" "connected"
test_json_field "Queue ready" "$API_URL/health" ".services.queue" "ready"

echo ""
echo "Service Connections:"
test_json_field "Supabase connected" "$API_URL/status" ".services.supabase.connected" "true"
test_json_field "Redis ping" "$API_URL/status" ".services.redis.ping" "true"

echo ""
echo "Public API Endpoints:"
test_endpoint "API root" "$API_URL/"
test_endpoint "Platforms list" "$API_URL/api/v1/platforms"

echo ""
echo "Protected Endpoints (expect 401):"
test_endpoint "Jobs list (no auth)" "$API_URL/api/v1/jobs" "401"
test_endpoint "Credits (no auth)" "$API_URL/api/v1/credits" "401"
test_endpoint "Profile (no auth)" "$API_URL/api/v1/profile" "401"

echo ""

# ═══════════════════════════════════════════════════════════════════
# RENDER INPAINT SERVICE TESTS
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Render Inpaint Service ($INPAINT_URL) ━━━${NC}"
echo ""
echo "Health Endpoints:"
test_endpoint "Health" "$INPAINT_URL/health"
test_json_field "Inpaint status" "$INPAINT_URL/health" ".status" "healthy"

echo ""

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Integration Tests ━━━${NC}"
echo ""

# Test queue stats accessible
QUEUE_STATS=$(curl -s --max-time $TIMEOUT "$API_URL/status" | jq '.services.queue.stats' 2>/dev/null)
if [ -n "$QUEUE_STATS" ] && [ "$QUEUE_STATS" != "null" ]; then
    WAITING=$(echo "$QUEUE_STATS" | jq -r '.waiting')
    COMPLETED=$(echo "$QUEUE_STATS" | jq -r '.completed')
    log_test "pass" "Queue stats accessible" "waiting=$WAITING, completed=$COMPLETED"
else
    log_test "fail" "Queue stats accessible" "Cannot read queue"
fi

# Test Meta Pixel config
PIXEL_CONFIG=$(curl -s --max-time $TIMEOUT "$WEB_URL/api/test/pixel" | jq -r '.capiConfigured' 2>/dev/null)
if [ "$PIXEL_CONFIG" = "true" ]; then
    log_test "pass" "Meta Pixel CAPI configured" "capiConfigured=true"
else
    log_test "fail" "Meta Pixel CAPI configured" "capiConfigured=$PIXEL_CONFIG"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Summary ━━━${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo -e "  Total:  $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ALL TESTS PASSED ✓                                               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  $FAILED TEST(S) FAILED                                              ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
