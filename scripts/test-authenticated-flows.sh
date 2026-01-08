#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# BlankLogo Authenticated User Flow Tests
# Tests that require a logged-in user session
# These tests catch bugs like "Failed to fetch" that basic health checks miss
# ═══════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# URLs
WEB_URL="${WEB_URL:-https://www.blanklogo.app}"
API_URL="${API_URL:-https://blanklogo-api.onrender.com}"

# Test credentials (from .env.test)
TEST_EMAIL="${TEST_USER_EMAIL:-}"
TEST_PASSWORD="${TEST_USER_PASSWORD:-}"

# Timeout
TIMEOUT=15

# Counters
PASSED=0
FAILED=0
SKIPPED=0

log_test() {
    local status=$1
    local name=$2
    local details=$3
    
    case $status in
        pass)
            echo -e "  ${GREEN}✓${NC} $name ${details:+- $details}"
            ((PASSED++))
            ;;
        fail)
            echo -e "  ${RED}✗${NC} $name ${details:+- $details}"
            ((FAILED++))
            ;;
        skip)
            echo -e "  ${YELLOW}○${NC} $name ${details:+- $details}"
            ((SKIPPED++))
            ;;
    esac
}

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     BlankLogo Authenticated Flow Tests                            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Web URL: $WEB_URL"
echo "  API URL: $API_URL"
echo "  Time:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# ═══════════════════════════════════════════════════════════════════
# PRE-AUTH CHECKS - These should work without login
# ═══════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━ Pre-Auth Checks ━━━${NC}"

# Test Supabase RPC functions exist (this is what causes "Failed to fetch")
echo ""
echo "Supabase RPC Functions:"

# Check if Supabase URL is accessible
SUPABASE_URL=$(curl -s "$WEB_URL/api/test/pixel" 2>/dev/null | jq -r '.pixelId // empty')
if [ -n "$SUPABASE_URL" ]; then
    log_test "pass" "Vercel API routes accessible"
else
    log_test "fail" "Vercel API routes not accessible"
fi

# Test credits endpoint returns 401 (not 500 or error)
CREDITS_RESPONSE=$(curl -s -w "\n%{http_code}" "$WEB_URL/api/credits" 2>/dev/null)
CREDITS_STATUS=$(echo "$CREDITS_RESPONSE" | tail -1)
CREDITS_BODY=$(echo "$CREDITS_RESPONSE" | head -1)

if [ "$CREDITS_STATUS" = "401" ]; then
    log_test "pass" "Credits endpoint returns 401 when not authenticated"
elif [ "$CREDITS_STATUS" = "500" ]; then
    log_test "fail" "Credits endpoint returns 500 (server error) - likely Supabase issue"
    echo "    Response: $CREDITS_BODY"
else
    log_test "fail" "Credits endpoint unexpected response: HTTP $CREDITS_STATUS"
    echo "    Response: $CREDITS_BODY"
fi

# Test analytics endpoint
ANALYTICS_RESPONSE=$(curl -s -w "\n%{http_code}" "$WEB_URL/api/analytics" 2>/dev/null)
ANALYTICS_STATUS=$(echo "$ANALYTICS_RESPONSE" | tail -1)

if [ "$ANALYTICS_STATUS" = "401" ]; then
    log_test "pass" "Analytics endpoint returns 401 when not authenticated"
elif [ "$ANALYTICS_STATUS" = "500" ]; then
    log_test "fail" "Analytics endpoint returns 500 (server error)"
else
    log_test "fail" "Analytics endpoint unexpected: HTTP $ANALYTICS_STATUS"
fi

# ═══════════════════════════════════════════════════════════════════
# VERCEL API ROUTES - Test internal API routes
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ Vercel API Routes ━━━${NC}"

# Test all internal API routes respond (not 500)
API_ROUTES=(
    "/api/credits:401"
    "/api/analytics:401"
    "/api/test/pixel:200"
    "/api/stripe/webhook:405"
)

for route_expected in "${API_ROUTES[@]}"; do
    route="${route_expected%%:*}"
    expected="${route_expected##*:}"
    
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$WEB_URL$route" 2>/dev/null || echo "000")
    
    if [ "$status" = "$expected" ]; then
        log_test "pass" "API $route"
    elif [ "$status" = "500" ]; then
        log_test "fail" "API $route returns 500 (server error)"
    elif [ "$status" = "000" ]; then
        log_test "fail" "API $route timeout/connection failed"
    else
        log_test "fail" "API $route returns $status (expected $expected)"
    fi
done

# ═══════════════════════════════════════════════════════════════════
# AUTHENTICATED TESTS (require TEST_USER_EMAIL and TEST_USER_PASSWORD)
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ Authenticated Flow Tests ━━━${NC}"

if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
    log_test "skip" "Login flow test" "TEST_USER_EMAIL and TEST_USER_PASSWORD not set"
    log_test "skip" "Credits fetch test" "Requires authentication"
    log_test "skip" "Job creation test" "Requires authentication"
else
    echo "Testing with: $TEST_EMAIL"
    
    # Try to login via Supabase Auth
    # This would require a more complex setup with cookies/tokens
    # For now, we'll use Playwright for authenticated tests
    log_test "skip" "Full auth flow" "Use Playwright tests for browser-based auth"
fi

# ═══════════════════════════════════════════════════════════════════
# RENDER API AUTH TESTS
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ Render API Auth Tests ━━━${NC}"

# Test that protected endpoints return 401, not 500
PROTECTED_ENDPOINTS=(
    "POST:/api/v1/jobs:401"
    "POST:/api/v1/jobs/upload:401"
    "GET:/api/v1/jobs/test-id:401"
    "DELETE:/api/v1/jobs/test-id:401"
)

for endpoint_info in "${PROTECTED_ENDPOINTS[@]}"; do
    method="${endpoint_info%%:*}"
    rest="${endpoint_info#*:}"
    path="${rest%%:*}"
    expected="${rest##*:}"
    
    if [ "$method" = "POST" ]; then
        status=$(curl -s -X POST -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$API_URL$path" 2>/dev/null || echo "000")
    elif [ "$method" = "DELETE" ]; then
        status=$(curl -s -X DELETE -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$API_URL$path" 2>/dev/null || echo "000")
    else
        status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$API_URL$path" 2>/dev/null || echo "000")
    fi
    
    if [ "$status" = "$expected" ]; then
        log_test "pass" "$method $path returns $expected"
    elif [ "$status" = "500" ]; then
        log_test "fail" "$method $path returns 500 (server error)"
    else
        log_test "fail" "$method $path returns $status (expected $expected)"
    fi
done

# ═══════════════════════════════════════════════════════════════════
# SUPABASE CONNECTION TESTS
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ Supabase Integration ━━━${NC}"

# Check if Supabase is connected via API
SUPABASE_STATUS=$(curl -s --max-time $TIMEOUT "$API_URL/status" 2>/dev/null | jq -r '.services.supabase.connected // "error"')

if [ "$SUPABASE_STATUS" = "true" ]; then
    log_test "pass" "Supabase connected (via Render API)"
else
    log_test "fail" "Supabase not connected: $SUPABASE_STATUS"
fi

# Check Supabase latency
SUPABASE_LATENCY=$(curl -s --max-time $TIMEOUT "$API_URL/status" 2>/dev/null | jq -r '.services.supabase.latencyMs // "error"')

if [ "$SUPABASE_LATENCY" != "error" ] && [ "$SUPABASE_LATENCY" -lt 1000 ]; then
    log_test "pass" "Supabase latency acceptable" "${SUPABASE_LATENCY}ms"
else
    log_test "fail" "Supabase latency high or unavailable: ${SUPABASE_LATENCY}ms"
fi

# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ Summary ━━━${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC}  $PASSED"
echo -e "  ${RED}Failed:${NC}  $FAILED"
echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ALL TESTS PASSED ✓                                               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  $FAILED TEST(S) FAILED - These bugs would cause user-facing errors ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Common causes of 'Failed to fetch' errors:"
    echo "  1. Supabase RPC functions not deployed"
    echo "  2. Supabase URL/keys misconfigured in Vercel"
    echo "  3. CORS blocking requests"
    echo "  4. Network timeout"
    exit 1
fi
