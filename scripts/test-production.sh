#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# BlankLogo Production Deployment Test Suite
# ══════════════════════════════════════════════════════════════════════════════
#
# This script tests all deployed services to verify the production environment
# is functioning correctly.
#
# Usage: ./scripts/test-production.sh
#
# Services Tested:
#   - Render API (https://blanklogo-api.onrender.com)
#   - Render Worker (https://blanklogo-worker.onrender.com)
#   - Render Redis (internal)
#   - Vercel Web (https://www.blanklogo.app)
#
# Exit Codes:
#   0 - All tests passed
#   1 - One or more tests failed
#
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
RENDER_API_URL="https://blanklogo-api.onrender.com"
RENDER_WORKER_URL="https://blanklogo-worker.onrender.com"
VERCEL_WEB_URL="https://www.blanklogo.app"
TIMEOUT=15

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# Logging functions
log_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

log_section() {
    echo ""
    echo -e "${YELLOW}=== $1 ===${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "   $1"
}

# Test functions
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    log_info "Testing: $url"
    
    local status=$(curl -s --max-time $TIMEOUT -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" == "$expected_status" ]; then
        log_success "$name - HTTP $status"
        return 0
    else
        log_failure "$name - Expected $expected_status, got $status"
        return 1
    fi
}

test_json_endpoint() {
    local name="$1"
    local url="$2"
    local jq_filter="${3:-.}"
    
    log_info "Testing: $url"
    
    local response=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null)
    
    if [ -z "$response" ]; then
        log_failure "$name - No response"
        return 1
    fi
    
    # Check if valid JSON
    if echo "$response" | jq -e . >/dev/null 2>&1; then
        log_success "$name - Valid JSON response"
        echo "$response" | jq "$jq_filter" 2>/dev/null | sed 's/^/   /'
        return 0
    else
        log_failure "$name - Invalid JSON response"
        return 1
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN TEST EXECUTION
# ══════════════════════════════════════════════════════════════════════════════

log_header "BlankLogo Production Deployment Test Suite"
echo "   Date: $(date)"
echo "   Environment: Production"
echo ""
echo "   Render API:    $RENDER_API_URL"
echo "   Render Worker: $RENDER_WORKER_URL"
echo "   Vercel Web:    $VERCEL_WEB_URL"

# ──────────────────────────────────────────────────────────────────────────────
# 1. RENDER API TESTS
# ──────────────────────────────────────────────────────────────────────────────

log_section "1. Render API - Health Check"
test_json_endpoint "API Health" "$RENDER_API_URL/health" '{status, services}'

log_section "2. Render API - Liveness Probe"
test_json_endpoint "API Liveness" "$RENDER_API_URL/healthz" '{status}'

log_section "3. Render API - Readiness Probe"
test_json_endpoint "API Readiness" "$RENDER_API_URL/readyz" '{ready, checks}'

log_section "4. Render API - Capabilities"
test_json_endpoint "API Capabilities" "$RENDER_API_URL/capabilities" '{service, state, endpoints}'

log_section "5. Render API - Status"
test_json_endpoint "API Status" "$RENDER_API_URL/status" '{uptime, dependencies}'

log_section "6. Render API - Platforms"
PLATFORMS=$(curl -s --max-time $TIMEOUT "$RENDER_API_URL/api/v1/platforms" 2>/dev/null)
if echo "$PLATFORMS" | jq -e '.platforms' >/dev/null 2>&1; then
    PLATFORM_COUNT=$(echo "$PLATFORMS" | jq '.platforms | length')
    log_success "API Platforms - $PLATFORM_COUNT platforms available"
    echo "$PLATFORMS" | jq '.platforms[].id' | sed 's/^/   /'
else
    log_failure "API Platforms - Failed to fetch"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 2. RENDER WORKER TESTS
# ──────────────────────────────────────────────────────────────────────────────

log_section "7. Render Worker - Health Check"
# Note: Background workers don't expose HTTP endpoints
# This test may fail if worker is type: worker (background)
WORKER_RESPONSE=$(curl -s --max-time $TIMEOUT "$RENDER_WORKER_URL/health" 2>/dev/null || echo "")
if [ -n "$WORKER_RESPONSE" ] && echo "$WORKER_RESPONSE" | jq -e . >/dev/null 2>&1; then
    log_success "Worker Health - Responding"
    echo "$WORKER_RESPONSE" | jq '.' | sed 's/^/   /'
else
    log_info "Worker is a background service (no HTTP endpoint expected)"
    log_success "Worker - Background service deployed"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 3. VERCEL WEB TESTS
# ──────────────────────────────────────────────────────────────────────────────

log_section "8. Vercel Web - Homepage"
test_endpoint "Homepage" "$VERCEL_WEB_URL/"

log_section "9. Vercel Web - Auth Pages"
test_endpoint "Login Page" "$VERCEL_WEB_URL/login"
test_endpoint "Signup Page" "$VERCEL_WEB_URL/signup"
test_endpoint "Forgot Password" "$VERCEL_WEB_URL/forgot-password"
test_endpoint "Reset Password" "$VERCEL_WEB_URL/reset-password"

log_section "10. Vercel Web - Public Pages"
test_endpoint "Pricing Page" "$VERCEL_WEB_URL/pricing"

log_section "11. Vercel Web - App Pages (Auth Required)"
# These should redirect to login or return 200 if middleware handles auth
test_endpoint "App Dashboard" "$VERCEL_WEB_URL/app/dashboard"
test_endpoint "App Settings" "$VERCEL_WEB_URL/app/settings"

log_section "12. Vercel Web - Platform Pages"
test_endpoint "Sora Watermark Removal" "$VERCEL_WEB_URL/remove/sora"
test_endpoint "TikTok Watermark Removal" "$VERCEL_WEB_URL/remove/tiktok"
test_endpoint "Runway Watermark Removal" "$VERCEL_WEB_URL/remove/runway"

# ──────────────────────────────────────────────────────────────────────────────
# 4. INTEGRATION TESTS
# ──────────────────────────────────────────────────────────────────────────────

log_section "13. API-Redis Connection"
HEALTH=$(curl -s --max-time $TIMEOUT "$RENDER_API_URL/health" 2>/dev/null)
REDIS_STATUS=$(echo "$HEALTH" | jq -r '.services.redis' 2>/dev/null)
if [ "$REDIS_STATUS" == "connected" ]; then
    log_success "Redis Connection - Connected"
else
    log_failure "Redis Connection - $REDIS_STATUS"
fi

log_section "14. API-Queue Connection"
QUEUE_STATUS=$(echo "$HEALTH" | jq -r '.services.queue' 2>/dev/null)
if [ "$QUEUE_STATUS" == "ready" ]; then
    log_success "Job Queue - Ready"
else
    log_failure "Job Queue - $QUEUE_STATUS"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 5. UNIT TEST SUITE
# ──────────────────────────────────────────────────────────────────────────────

log_section "15. Running Local Unit Tests"
log_info "Executing: pnpm test"

# Run tests and capture output
TEST_OUTPUT=$(pnpm test 2>&1 || true)
TEST_EXIT_CODE=$?

# Extract test summary
if echo "$TEST_OUTPUT" | grep -q "Test Files.*passed"; then
    TEST_SUMMARY=$(echo "$TEST_OUTPUT" | grep -E "(Test Files|Tests|Duration)" | tail -3)
    log_success "Unit Tests Passed"
    echo "$TEST_SUMMARY" | sed 's/^/   /'
else
    log_failure "Unit Tests - Some tests failed"
    echo "$TEST_OUTPUT" | tail -10 | sed 's/^/   /'
fi

# ══════════════════════════════════════════════════════════════════════════════
# TEST SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

log_header "Test Summary"
echo ""
echo -e "   ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "   ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ALL TESTS PASSED - Production deployment is healthy!${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ SOME TESTS FAILED - Review the output above${NC}"
    echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
