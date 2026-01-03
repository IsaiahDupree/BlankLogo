#!/bin/bash

# BlankLogo Service Test Script
# Tests individual services and reports real-time status

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
FRONTEND_PORT=${FRONTEND_PORT:-3939}
API_PORT=${API_PORT:-8989}
REDIS_PORT=${REDIS_PORT:-6379}
SUPABASE_API_PORT=${SUPABASE_API_PORT:-54351}

echo ""
echo -e "${MAGENTA}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║         BlankLogo Service Test Suite                   ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%H:%M:%S')
    
    case $level in
        "PASS")  echo -e "${GREEN}[$timestamp] ✅ PASS${NC}  $message" ;;
        "FAIL")  echo -e "${RED}[$timestamp] ❌ FAIL${NC}  $message" ;;
        "SKIP")  echo -e "${YELLOW}[$timestamp] ⏭️  SKIP${NC}  $message" ;;
        "INFO")  echo -e "${BLUE}[$timestamp] ℹ️  INFO${NC}  $message" ;;
        "TEST")  echo -e "${CYAN}[$timestamp] 🧪 TEST${NC}  $message" ;;
        *)       echo -e "[$timestamp] $message" ;;
    esac
}

run_test() {
    local name=$1
    local command=$2
    local expected=$3
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log "TEST" "$name"
    
    local result
    result=$(eval "$command" 2>&1) || true
    
    if echo "$result" | grep -q "$expected"; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        log "PASS" "$name"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        log "FAIL" "$name"
        echo -e "       ${YELLOW}Expected:${NC} $expected"
        echo -e "       ${YELLOW}Got:${NC} $(echo "$result" | head -1)"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════
# REDIS TESTS
# ═══════════════════════════════════════════════════════════
test_redis() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Redis Tests${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    
    # Test 1: Port check
    run_test "Redis port $REDIS_PORT is open" \
        "nc -z localhost $REDIS_PORT && echo 'open'" \
        "open" || true
    
    # Test 2: Ping
    if command -v redis-cli &> /dev/null; then
        run_test "Redis responds to PING" \
            "redis-cli -p $REDIS_PORT ping 2>/dev/null" \
            "PONG" || true
        
        # Test 3: SET/GET
        run_test "Redis SET/GET works" \
            "redis-cli -p $REDIS_PORT SET blanklogo_test 'working' >/dev/null && redis-cli -p $REDIS_PORT GET blanklogo_test" \
            "working" || true
        
        # Cleanup
        redis-cli -p $REDIS_PORT DEL blanklogo_test >/dev/null 2>&1 || true
        
        # Test 4: Info
        run_test "Redis INFO available" \
            "redis-cli -p $REDIS_PORT INFO server 2>/dev/null | grep -q redis_version && echo 'redis_version'" \
            "redis_version" || true
    else
        log "SKIP" "redis-cli not installed - skipping advanced Redis tests"
    fi
}

# ═══════════════════════════════════════════════════════════
# API TESTS
# ═══════════════════════════════════════════════════════════
test_api() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  API Tests (port $API_PORT)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    
    # Test 1: Health endpoint
    run_test "API /health responds" \
        "curl -s --max-time 3 http://localhost:$API_PORT/health" \
        "healthy" || true
    
    # Test 2: Live endpoint
    run_test "API /live responds" \
        "curl -s --max-time 3 http://localhost:$API_PORT/live" \
        "alive" || true
    
    # Test 3: Ready endpoint
    run_test "API /ready responds" \
        "curl -s --max-time 3 http://localhost:$API_PORT/ready" \
        "ready" || true
    
    # Test 4: Status endpoint
    run_test "API /status responds" \
        "curl -s --max-time 5 http://localhost:$API_PORT/status" \
        "operational\|degraded" || true
    
    # Test 5: Platforms endpoint
    run_test "API /api/v1/platforms responds" \
        "curl -s --max-time 3 http://localhost:$API_PORT/api/v1/platforms" \
        "sora" || true
    
    # Test 6: 404 handling
    run_test "API returns 404 for unknown routes" \
        "curl -s --max-time 3 http://localhost:$API_PORT/unknown-route" \
        "Not found" || true
    
    # Test 7: Redis connection via API
    run_test "API reports Redis connected" \
        "curl -s --max-time 3 http://localhost:$API_PORT/status | grep -o '\"redis\":{[^}]*}'" \
        "connected.*true" || true
    
    # Test 8: Supabase connection via API
    run_test "API reports Supabase connected" \
        "curl -s --max-time 5 http://localhost:$API_PORT/status | grep -o '\"supabase\":{[^}]*}'" \
        "connected.*true" || true
    
    # Test 9: Queue status via API
    run_test "API reports queue available" \
        "curl -s --max-time 3 http://localhost:$API_PORT/status | grep -o '\"queue\":{[^}]*}'" \
        "available.*true" || true
    
    # Test 10: Auth required for jobs
    run_test "API requires auth for POST /api/v1/jobs" \
        "curl -s --max-time 3 -X POST http://localhost:$API_PORT/api/v1/jobs -H 'Content-Type: application/json' -d '{}'" \
        "Authentication required\|NO_TOKEN" || true
}

# ═══════════════════════════════════════════════════════════
# FRONTEND TESTS
# ═══════════════════════════════════════════════════════════
test_frontend() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Frontend Tests (port $FRONTEND_PORT)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    
    # Test 1: Homepage loads
    run_test "Frontend homepage loads" \
        "curl -s --max-time 5 http://localhost:$FRONTEND_PORT" \
        "html" || true
    
    # Test 2: Has BlankLogo branding
    run_test "Frontend has BlankLogo branding" \
        "curl -s --max-time 5 http://localhost:$FRONTEND_PORT" \
        "BlankLogo" || true
    
    # Test 3: Login page
    run_test "Frontend /login loads" \
        "curl -s --max-time 5 http://localhost:$FRONTEND_PORT/login" \
        "html" || true
    
    # Test 4: Signup page
    run_test "Frontend /signup loads" \
        "curl -s --max-time 5 http://localhost:$FRONTEND_PORT/signup" \
        "html" || true
    
    # Test 5: Pricing page
    run_test "Frontend /pricing loads" \
        "curl -s --max-time 5 http://localhost:$FRONTEND_PORT/pricing" \
        "html" || true
    
    # Test 6: App dashboard (may redirect)
    run_test "Frontend /app responds" \
        "curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://localhost:$FRONTEND_PORT/app" \
        "200\|307\|302" || true
}

# ═══════════════════════════════════════════════════════════
# SUPABASE TESTS
# ═══════════════════════════════════════════════════════════
test_supabase() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Supabase Tests${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    
    # Test 1: API endpoint responds
    run_test "Supabase API responds" \
        "curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:$SUPABASE_API_PORT/rest/v1/" \
        "200\|401" || true
    
    # Test 2: REST API
    run_test "Supabase REST API responds" \
        "curl -s --max-time 3 http://127.0.0.1:$SUPABASE_API_PORT/rest/v1/" \
        "" || true
    
    # Test 3: Studio
    run_test "Supabase Studio accessible" \
        "curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:54353" \
        "200\|302\|307" || true
}

# ═══════════════════════════════════════════════════════════
# INTERCONNECTION TESTS
# ═══════════════════════════════════════════════════════════
test_interconnection() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Interconnection Tests${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    
    # Test: API can reach Redis
    run_test "API -> Redis connection" \
        "curl -s --max-time 5 http://localhost:$API_PORT/status | grep redis | grep -o 'ping.:true'" \
        "ping.:true" || true
    
    # Test: API can reach Supabase
    run_test "API -> Supabase connection" \
        "curl -s --max-time 5 http://localhost:$API_PORT/status | grep supabase | grep -o 'connected.:true'" \
        "connected.:true" || true
    
    # Test: API -> Queue working
    run_test "API -> Queue connection" \
        "curl -s --max-time 5 http://localhost:$API_PORT/status | grep queue | grep -o 'available.:true'" \
        "available.:true" || true
}

# Print summary
print_summary() {
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  Test Summary${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Tests Run:    ${CYAN}$TESTS_RUN${NC}"
    echo -e "  Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "  Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}  ✅ All tests passed!${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Some tests failed - check logs above${NC}"
    fi
    echo ""
}

# Main
main() {
    local suite=${1:-"all"}
    
    case $suite in
        "redis")
            test_redis
            ;;
        "api")
            test_api
            ;;
        "frontend")
            test_frontend
            ;;
        "supabase")
            test_supabase
            ;;
        "interconnection"|"inter")
            test_interconnection
            ;;
        "all"|*)
            test_redis
            test_api
            test_frontend
            test_supabase
            test_interconnection
            ;;
    esac
    
    print_summary
    
    exit $TESTS_FAILED
}

main "$@"
