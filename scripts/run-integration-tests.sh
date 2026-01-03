#!/bin/bash

# BlankLogo Integration Test Runner
# Runs comprehensive integration tests with status reporting

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL=${API_URL:-"http://localhost:8989"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3939"}

echo ""
echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║        BlankLogo Integration Test Suite                    ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%H:%M:%S')
    
    case $level in
        "INFO")  echo -e "${BLUE}[$timestamp]${NC} ${GREEN}ℹ${NC}  $message" ;;
        "PASS")  echo -e "${BLUE}[$timestamp]${NC} ${GREEN}✅${NC} $message" ;;
        "FAIL")  echo -e "${BLUE}[$timestamp]${NC} ${RED}❌${NC} $message" ;;
        "WARN")  echo -e "${BLUE}[$timestamp]${NC} ${YELLOW}⚠️${NC}  $message" ;;
        "TEST")  echo -e "${BLUE}[$timestamp]${NC} ${CYAN}🧪${NC} $message" ;;
        *)       echo -e "[$timestamp] $message" ;;
    esac
}

# Pre-flight checks
preflight_checks() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "Running pre-flight checks..."
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check API
    log "TEST" "Checking API at $API_URL..."
    if curl -s --max-time 5 "$API_URL/health" > /dev/null 2>&1; then
        log "PASS" "API is running"
    else
        log "FAIL" "API is not running at $API_URL"
        log "INFO" "Start with: pnpm start:api"
        exit 1
    fi
    
    # Check Frontend
    log "TEST" "Checking Frontend at $FRONTEND_URL..."
    if curl -s --max-time 5 "$FRONTEND_URL" > /dev/null 2>&1; then
        log "PASS" "Frontend is running"
    else
        log "WARN" "Frontend may not be running at $FRONTEND_URL"
    fi
    
    # Check Redis via API
    log "TEST" "Checking Redis connectivity..."
    local status=$(curl -s "$API_URL/status" 2>/dev/null)
    if echo "$status" | grep -q '"redis".*"connected":true'; then
        log "PASS" "Redis is connected"
    else
        log "WARN" "Redis may not be connected"
    fi
    
    echo ""
}

# Run vitest integration tests
run_vitest_tests() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "Running Vitest Integration Tests..."
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    cd "$PROJECT_ROOT"
    
    API_URL="$API_URL" FRONTEND_URL="$FRONTEND_URL" \
        pnpm vitest run tests/integration --reporter=verbose 2>&1 || {
            log "WARN" "Some integration tests failed"
        }
}

# Quick connectivity tests
run_quick_tests() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "Running Quick Connectivity Tests..."
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local passed=0
    local failed=0
    
    # Test 1: Health
    log "TEST" "API Health..."
    if curl -s "$API_URL/health" | grep -q "healthy"; then
        log "PASS" "Health endpoint OK"
        passed=$((passed + 1))
    else
        log "FAIL" "Health endpoint failed"
        failed=$((failed + 1))
    fi
    
    # Test 2: Live
    log "TEST" "API Liveness..."
    if curl -s "$API_URL/live" | grep -q "alive"; then
        log "PASS" "Liveness probe OK"
        passed=$((passed + 1))
    else
        log "FAIL" "Liveness probe failed"
        failed=$((failed + 1))
    fi
    
    # Test 3: Ready
    log "TEST" "API Readiness..."
    if curl -s "$API_URL/ready" | grep -q "ready"; then
        log "PASS" "Readiness probe OK"
        passed=$((passed + 1))
    else
        log "WARN" "Readiness probe: not fully ready"
        failed=$((failed + 1))
    fi
    
    # Test 4: Status
    log "TEST" "API Status..."
    local status=$(curl -s "$API_URL/status")
    if echo "$status" | grep -q "operational\|degraded"; then
        log "PASS" "Status endpoint OK"
        passed=$((passed + 1))
        
        # Extract service statuses
        local redis=$(echo "$status" | grep -o '"redis":{[^}]*}' | grep -o '"connected":[^,]*')
        local queue=$(echo "$status" | grep -o '"queue":{[^}]*}' | grep -o '"available":[^,]*')
        local supabase=$(echo "$status" | grep -o '"supabase":{[^}]*}' | grep -o '"connected":[^,]*')
        
        echo "       Redis: $redis"
        echo "       Queue: $queue"
        echo "       Supabase: $supabase"
    else
        log "FAIL" "Status endpoint failed"
        failed=$((failed + 1))
    fi
    
    # Test 5: Platforms
    log "TEST" "Platforms API..."
    if curl -s "$API_URL/api/v1/platforms" | grep -q "sora"; then
        log "PASS" "Platforms endpoint OK"
        passed=$((passed + 1))
    else
        log "FAIL" "Platforms endpoint failed"
        failed=$((failed + 1))
    fi
    
    # Test 6: Auth
    log "TEST" "Auth Enforcement..."
    local auth_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/v1/jobs" -H "Content-Type: application/json" -d '{}')
    if [ "$auth_response" = "401" ]; then
        log "PASS" "Auth enforcement OK (401)"
        passed=$((passed + 1))
    else
        log "FAIL" "Auth enforcement failed (got $auth_response)"
        failed=$((failed + 1))
    fi
    
    # Test 7: 404
    log "TEST" "404 Handler..."
    if curl -s "$API_URL/nonexistent" | grep -q "Not found"; then
        log "PASS" "404 handler OK"
        passed=$((passed + 1))
    else
        log "FAIL" "404 handler failed"
        failed=$((failed + 1))
    fi
    
    # Test 8: Frontend
    log "TEST" "Frontend Homepage..."
    if curl -s "$FRONTEND_URL" | grep -q "BlankLogo\|html"; then
        log "PASS" "Frontend OK"
        passed=$((passed + 1))
    else
        log "WARN" "Frontend not responding"
        failed=$((failed + 1))
    fi
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "Quick Tests: $passed passed, $failed failed"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    return $failed
}

# Print full status
print_status() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "Full System Status"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    curl -s "$API_URL/status" | python3 -m json.tool 2>/dev/null || \
    curl -s "$API_URL/status" | jq . 2>/dev/null || \
    curl -s "$API_URL/status"
    
    echo ""
}

# Main
main() {
    local mode=${1:-"quick"}
    
    case $mode in
        "quick"|"q")
            preflight_checks
            run_quick_tests
            ;;
        "full"|"f")
            preflight_checks
            run_quick_tests
            run_vitest_tests
            ;;
        "vitest"|"v")
            preflight_checks
            run_vitest_tests
            ;;
        "status"|"s")
            print_status
            ;;
        *)
            echo "Usage: $0 [quick|full|vitest|status]"
            echo ""
            echo "  quick   - Run quick connectivity tests (default)"
            echo "  full    - Run all tests including vitest"
            echo "  vitest  - Run vitest integration tests only"
            echo "  status  - Print full system status"
            ;;
    esac
}

main "$@"
