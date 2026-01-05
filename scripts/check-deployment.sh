#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# BlankLogo Deployment Health Check Script
# Run after deployment to verify all services are working correctly
# ═══════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default URLs (can be overridden via environment variables)
API_URL="${DEPLOY_API_URL:-${API_URL:-https://blanklogo-api.onrender.com}}"
WEB_URL="${DEPLOY_WEB_URL:-${WEB_URL:-https://www.blanklogo.app}}"
WORKER_URL="${DEPLOY_WORKER_URL:-${WORKER_URL:-}}"  # Worker may not have external URL

# Timeout for requests
TIMEOUT=30

# Track results
PASSED=0
FAILED=0
WARNED=0

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
}

print_result() {
    local status=$1
    local name=$2
    local details=$3
    
    case $status in
        "pass")
            echo -e "  ${GREEN}✓${NC} $name ${details:+- $details}"
            ((PASSED++))
            ;;
        "fail")
            echo -e "  ${RED}✗${NC} $name ${details:+- $details}"
            ((FAILED++))
            ;;
        "warn")
            echo -e "  ${YELLOW}⚠${NC} $name ${details:+- $details}"
            ((WARNED++))
            ;;
        "skip")
            echo -e "  ${BLUE}○${NC} $name ${details:+- $details}"
            ;;
    esac
}

check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    local start_time=$(date +%s%N)
    local response=$(curl -s -o /tmp/response.json -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
    local end_time=$(date +%s%N)
    local latency=$(( (end_time - start_time) / 1000000 ))
    
    if [ "$response" = "$expected_status" ]; then
        print_result "pass" "$name" "${latency}ms"
        return 0
    elif [ "$response" = "000" ]; then
        print_result "fail" "$name" "Connection failed/timeout"
        return 1
    else
        print_result "fail" "$name" "HTTP $response (expected $expected_status)"
        return 1
    fi
}

check_json_field() {
    local url=$1
    local name=$2
    local field=$3
    local expected=$4
    
    local response=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null)
    local value=$(echo "$response" | jq -r "$field" 2>/dev/null)
    
    if [ "$value" = "$expected" ]; then
        print_result "pass" "$name" "$field = $value"
        return 0
    elif [ "$value" = "null" ] || [ -z "$value" ]; then
        print_result "fail" "$name" "$field not found"
        return 1
    else
        print_result "fail" "$name" "$field = $value (expected $expected)"
        return 1
    fi
}

run_diagnostics() {
    local url=$1
    local name=$2
    
    echo ""
    echo -e "  Running diagnostics for ${BLUE}$name${NC}..."
    
    local response=$(curl -s --max-time $TIMEOUT "$url/diagnostics" 2>/dev/null)
    
    if [ -z "$response" ]; then
        print_result "fail" "$name diagnostics" "No response"
        return 1
    fi
    
    local overall=$(echo "$response" | jq -r '.overall_status' 2>/dev/null)
    local total=$(echo "$response" | jq -r '.summary.total' 2>/dev/null)
    local passed=$(echo "$response" | jq -r '.summary.passed' 2>/dev/null)
    local failed=$(echo "$response" | jq -r '.summary.failed' 2>/dev/null)
    local warned=$(echo "$response" | jq -r '.summary.warned' 2>/dev/null)
    
    if [ "$overall" = "healthy" ]; then
        print_result "pass" "$name diagnostics" "$passed/$total tests passed"
    elif [ "$overall" = "degraded" ]; then
        print_result "warn" "$name diagnostics" "$passed passed, $warned warnings"
    else
        print_result "fail" "$name diagnostics" "$failed/$total tests failed"
    fi
    
    # Show individual test results
    echo "$response" | jq -r '.tests[] | "    \(.status | if . == "pass" then "✓" elif . == "fail" then "✗" else "⚠" end) \(.name): \(.details // .error // "ok")"' 2>/dev/null
    
    return 0
}

# ═══════════════════════════════════════════════════════════════════
# MAIN CHECKS
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          BlankLogo Deployment Health Check                        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  API URL:    $API_URL"
echo "  Web URL:    $WEB_URL"
echo "  Worker URL: ${WORKER_URL:-'(not configured)'}"
echo "  Timestamp:  $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# ─────────────────────────────────────────────────────────────────────
# API Health Checks
# ─────────────────────────────────────────────────────────────────────
print_header "API Service ($API_URL)"

check_endpoint "$API_URL/health" "Health endpoint"
check_endpoint "$API_URL/healthz" "Liveness probe (healthz)"
check_endpoint "$API_URL/readyz" "Readiness probe (readyz)"
check_json_field "$API_URL/health" "Health status" ".status" "healthy"
check_json_field "$API_URL/health" "Redis connected" ".services.redis" "connected"
check_json_field "$API_URL/health" "Queue ready" ".services.queue" "ready"

# Run full diagnostics
run_diagnostics "$API_URL" "API"

# ─────────────────────────────────────────────────────────────────────
# Web Frontend Checks
# ─────────────────────────────────────────────────────────────────────
print_header "Web Frontend ($WEB_URL)"

check_endpoint "$WEB_URL" "Homepage"
check_endpoint "$WEB_URL/login" "Login page"
check_endpoint "$WEB_URL/signup" "Signup page"

# Check if page contains expected content
HOMEPAGE=$(curl -s --max-time $TIMEOUT "$WEB_URL" 2>/dev/null)
if echo "$HOMEPAGE" | grep -qi "blanklogo"; then
    print_result "pass" "Homepage content" "Contains 'BlankLogo'"
else
    print_result "warn" "Homepage content" "Missing expected content"
fi

# ─────────────────────────────────────────────────────────────────────
# Worker Health Checks (if URL provided)
# ─────────────────────────────────────────────────────────────────────
if [ -n "$WORKER_URL" ]; then
    print_header "Worker Service ($WORKER_URL)"
    
    check_endpoint "$WORKER_URL/health" "Health endpoint"
    check_endpoint "$WORKER_URL/readyz" "Readiness probe"
    
    # Run full diagnostics
    run_diagnostics "$WORKER_URL" "Worker"
else
    print_header "Worker Service"
    print_result "skip" "Worker health checks" "No WORKER_URL configured (background workers may not have external URLs)"
fi

# ─────────────────────────────────────────────────────────────────────
# Cross-Service Integration
# ─────────────────────────────────────────────────────────────────────
print_header "Integration Tests"

# Check API can reach queue
API_STATUS=$(curl -s --max-time $TIMEOUT "$API_URL/status" 2>/dev/null)
QUEUE_WAITING=$(echo "$API_STATUS" | jq -r '.services.queue.stats.waiting // "error"' 2>/dev/null)

if [ "$QUEUE_WAITING" != "error" ] && [ "$QUEUE_WAITING" != "null" ]; then
    print_result "pass" "API → Queue connection" "Queue accessible, $QUEUE_WAITING jobs waiting"
else
    print_result "fail" "API → Queue connection" "Cannot read queue stats"
fi

# Check Supabase connection
SUPABASE_OK=$(echo "$API_STATUS" | jq -r '.services.supabase.connected' 2>/dev/null)
if [ "$SUPABASE_OK" = "true" ]; then
    print_result "pass" "API → Supabase connection" "Database accessible"
else
    print_result "fail" "API → Supabase connection" "Database not accessible"
fi

# ─────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────
print_header "Summary"

echo ""
echo -e "  ${GREEN}Passed:${NC}  $PASSED"
echo -e "  ${RED}Failed:${NC}  $FAILED"
echo -e "  ${YELLOW}Warned:${NC}  $WARNED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  DEPLOYMENT HEALTH CHECK FAILED                                   ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
elif [ $WARNED -gt 0 ]; then
    echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  DEPLOYMENT HEALTH CHECK PASSED WITH WARNINGS                     ║${NC}"
    echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  DEPLOYMENT HEALTH CHECK PASSED                                   ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
fi
