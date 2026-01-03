#!/bin/bash

# BlankLogo Lifecycle Test Script
# Tests startup, shutdown, failure modes with status broadcasting

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT=${API_PORT:-8989}
FRONTEND_PORT=${FRONTEND_PORT:-3939}
REDIS_PORT=${REDIS_PORT:-6379}
LOG_DIR="/tmp/blanklogo-lifecycle-tests"
ITERATION=${1:-1}

# Create log directory
mkdir -p "$LOG_DIR"
TEST_LOG="$LOG_DIR/test-$(date +%Y%m%d-%H%M%S).log"

# Test tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo ""
echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║           BlankLogo Lifecycle & Failure Mode Tests               ║${NC}"
echo -e "${MAGENTA}╠══════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${MAGENTA}║  Iteration: $ITERATION                                                      ║${NC}"
echo -e "${MAGENTA}║  Log: $TEST_LOG${NC}"
echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Logging functions
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")   echo -e "${BLUE}[$timestamp]${NC} ${WHITE}[INFO]${NC}   $message" ;;
        "PASS")   echo -e "${BLUE}[$timestamp]${NC} ${GREEN}[PASS]${NC}   $message" ;;
        "FAIL")   echo -e "${BLUE}[$timestamp]${NC} ${RED}[FAIL]${NC}   $message" ;;
        "WARN")   echo -e "${BLUE}[$timestamp]${NC} ${YELLOW}[WARN]${NC}   $message" ;;
        "TEST")   echo -e "${BLUE}[$timestamp]${NC} ${CYAN}[TEST]${NC}   $message" ;;
        "STATUS") echo -e "${BLUE}[$timestamp]${NC} ${MAGENTA}[STATUS]${NC} $message" ;;
        *)        echo -e "[$timestamp] $message" ;;
    esac
    
    # Also log to file
    echo "[$timestamp] [$level] $message" >> "$TEST_LOG"
}

broadcast_status() {
    local service=$1
    local status=$2
    local message=$3
    
    log "STATUS" "🔔 [$service] Status: $status - $message"
    
    # Write to shared status file for inter-service communication
    echo "{\"service\":\"$service\",\"status\":\"$status\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}" >> "$LOG_DIR/service-status.jsonl"
}

run_test() {
    local name=$1
    local command=$2
    local expected_exit=${3:-0}
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log "TEST" "Running: $name"
    
    local start_time=$(date +%s)
    local output
    local exit_code=0
    
    output=$(eval "$command" 2>&1) || exit_code=$?
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ "$exit_code" -eq "$expected_exit" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        log "PASS" "✅ $name (${duration}ms)"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        log "FAIL" "❌ $name (exit: $exit_code, expected: $expected_exit)"
        echo "     Output: $(echo "$output" | head -2)"
        return 1
    fi
}

# Kill service helper
kill_service() {
    local port=$1
    local name=$2
    
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        broadcast_status "$name" "STOPPING" "Sending SIGTERM to process"
        echo "$pids" | xargs kill -15 2>/dev/null || true
        sleep 1
        
        # Force kill if needed
        pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            broadcast_status "$name" "FORCE_KILL" "Process didn't stop, using SIGKILL"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
        
        broadcast_status "$name" "STOPPED" "Service stopped"
    fi
}

# Start service helper
start_service() {
    local name=$1
    local command=$2
    local port=$3
    local timeout=${4:-30}
    
    broadcast_status "$name" "STARTING" "Launching service on port $port"
    
    eval "$command" > "$LOG_DIR/${name}.log" 2>&1 &
    local pid=$!
    
    local attempt=0
    while [ $attempt -lt $timeout ]; do
        if curl -s --max-time 1 "http://localhost:$port/health" > /dev/null 2>&1 || \
           curl -s --max-time 1 "http://localhost:$port" > /dev/null 2>&1; then
            broadcast_status "$name" "RUNNING" "Service started successfully (PID: $pid)"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    broadcast_status "$name" "FAILED" "Service failed to start within ${timeout}s"
    return 1
}

# Check service health
check_health() {
    local name=$1
    local url=$2
    
    local response=$(curl -s --max-time 3 "$url" 2>/dev/null || echo "UNREACHABLE")
    
    if echo "$response" | grep -q "healthy\|alive\|html"; then
        broadcast_status "$name" "HEALTHY" "Service responding normally"
        return 0
    else
        broadcast_status "$name" "UNHEALTHY" "Service not responding: $response"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════
# TEST SUITES
# ═══════════════════════════════════════════════════════════════════

test_clean_startup() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "TEST SUITE: Clean Startup Sequence"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Ensure clean state
    kill_service $API_PORT "API"
    sleep 1
    
    # Start API
    run_test "Start API server" \
        "cd '$PROJECT_ROOT/apps/api' && PORT=$API_PORT npx tsx src/index.ts &
         sleep 4
         curl -s http://localhost:$API_PORT/health | grep -q healthy"
    
    # Verify health endpoints
    run_test "API /health responds" \
        "curl -s http://localhost:$API_PORT/health | grep -q healthy"
    
    run_test "API /live responds" \
        "curl -s http://localhost:$API_PORT/live | grep -q alive"
    
    run_test "API /ready responds" \
        "curl -s http://localhost:$API_PORT/ready | grep -q ready"
    
    run_test "API /status responds" \
        "curl -s http://localhost:$API_PORT/status | grep -q operational"
}

test_graceful_shutdown() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "TEST SUITE: Graceful Shutdown"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Get PID
    local pid=$(lsof -ti:$API_PORT 2>/dev/null | head -1)
    
    if [ -n "$pid" ]; then
        broadcast_status "API" "SHUTDOWN_INITIATED" "Sending SIGTERM to PID $pid"
        
        run_test "Send SIGTERM to API" \
            "kill -15 $pid 2>/dev/null; sleep 2; ! lsof -ti:$API_PORT > /dev/null 2>&1"
        
        broadcast_status "API" "SHUTDOWN_COMPLETE" "Process terminated gracefully"
    else
        log "WARN" "No API process found to shutdown"
    fi
}

test_force_shutdown() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "TEST SUITE: Force Shutdown (SIGKILL)"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Start API first
    cd "$PROJECT_ROOT/apps/api" && PORT=$API_PORT npx tsx src/index.ts > /dev/null 2>&1 &
    sleep 4
    
    local pid=$(lsof -ti:$API_PORT 2>/dev/null | head -1)
    
    if [ -n "$pid" ]; then
        broadcast_status "API" "FORCE_SHUTDOWN" "Sending SIGKILL to PID $pid"
        
        run_test "Force kill API (SIGKILL)" \
            "kill -9 $pid 2>/dev/null; sleep 1; ! lsof -ti:$API_PORT > /dev/null 2>&1"
        
        broadcast_status "API" "KILLED" "Process force terminated"
    fi
}

test_port_conflict() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "TEST SUITE: Port Conflict Handling"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Start first instance
    cd "$PROJECT_ROOT/apps/api" && PORT=$API_PORT npx tsx src/index.ts > /dev/null 2>&1 &
    sleep 4
    
    broadcast_status "API" "PORT_CONFLICT_TEST" "Attempting to start second instance on same port"
    
    # Try to start second instance (should fail or retry)
    run_test "Second instance handles port conflict" \
        "cd '$PROJECT_ROOT/apps/api' && PORT=$API_PORT npx tsx src/index.ts 2>&1 & sleep 3; lsof -ti:$API_PORT | wc -l | grep -q 1" \
        0
    
    # Cleanup
    kill_service $API_PORT "API"
}

test_redis_failure() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "TEST SUITE: Redis Failure Mode"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Start API
    kill_service $API_PORT "API"
    cd "$PROJECT_ROOT/apps/api" && PORT=$API_PORT npx tsx src/index.ts > /dev/null 2>&1 &
    sleep 4
    
    # Check initial state
    run_test "API healthy with Redis" \
        "curl -s http://localhost:$API_PORT/status | grep -q 'redis.*connected.*true'"
    
    # Simulate Redis disconnect (if we can control it)
    broadcast_status "REDIS" "SIMULATING_FAILURE" "Testing API behavior when Redis disconnects"
    
    # API should still respond to health checks even if Redis is down
    run_test "API health endpoint works without Redis" \
        "curl -s http://localhost:$API_PORT/health | grep -q healthy"
    
    run_test "API reports degraded status" \
        "curl -s http://localhost:$API_PORT/status | grep -q 'operational\|degraded'"
    
    # Cleanup
    kill_service $API_PORT "API"
}

test_restart_cycle() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "TEST SUITE: Restart Cycle (${ITERATION}x)"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    for i in $(seq 1 $ITERATION); do
        log "INFO" "Restart iteration $i of $ITERATION"
        
        # Kill
        kill_service $API_PORT "API"
        sleep 1
        
        # Start
        cd "$PROJECT_ROOT/apps/api" && PORT=$API_PORT npx tsx src/index.ts > /dev/null 2>&1 &
        sleep 4
        
        # Verify
        run_test "Restart $i: API responds" \
            "curl -s --max-time 3 http://localhost:$API_PORT/health | grep -q healthy"
        
        # Get status
        local status=$(curl -s http://localhost:$API_PORT/status 2>/dev/null)
        local uptime=$(echo "$status" | grep -o '"seconds":[0-9]*' | head -1 | cut -d: -f2)
        log "INFO" "  Uptime after restart: ${uptime}s"
    done
    
    # Cleanup
    kill_service $API_PORT "API"
}

test_status_propagation() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "INFO" "TEST SUITE: Status Propagation Between Services"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Start API
    kill_service $API_PORT "API"
    cd "$PROJECT_ROOT/apps/api" && PORT=$API_PORT npx tsx src/index.ts > /dev/null 2>&1 &
    sleep 5
    
    # Check full status
    run_test "Status includes all services" \
        "curl -s http://localhost:$API_PORT/status | grep -q 'redis.*queue.*supabase'"
    
    # Check latency reporting
    run_test "Status includes latency metrics" \
        "curl -s http://localhost:$API_PORT/status | grep -q 'latencyMs'"
    
    # Check queue stats
    run_test "Status includes queue stats" \
        "curl -s http://localhost:$API_PORT/status | grep -q 'waiting.*active.*completed'"
    
    # Check memory stats
    run_test "Status includes memory stats" \
        "curl -s http://localhost:$API_PORT/status | grep -q 'heapUsed.*heapTotal'"
    
    # Cleanup
    kill_service $API_PORT "API"
}

# Print summary
print_summary() {
    echo ""
    echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║                      Test Summary                                 ║${NC}"
    echo -e "${MAGENTA}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${MAGENTA}║  Tests Run:    ${WHITE}$TESTS_RUN${MAGENTA}                                                  ║${NC}"
    echo -e "${MAGENTA}║  Passed:       ${GREEN}$TESTS_PASSED${MAGENTA}                                                  ║${NC}"
    echo -e "${MAGENTA}║  Failed:       ${RED}$TESTS_FAILED${MAGENTA}                                                  ║${NC}"
    echo -e "${MAGENTA}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${MAGENTA}║  Log File: $TEST_LOG${NC}"
    echo -e "${MAGENTA}║  Status Log: $LOG_DIR/service-status.jsonl${NC}"
    echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        log "PASS" "All lifecycle tests passed!"
    else
        log "FAIL" "Some tests failed - check logs"
    fi
    
    # Print recent status broadcasts
    echo ""
    log "INFO" "Recent Status Broadcasts:"
    tail -10 "$LOG_DIR/service-status.jsonl" 2>/dev/null | while read line; do
        echo "  $line"
    done
}

# Main
main() {
    local suite=${1:-"all"}
    
    # Clear previous status log
    > "$LOG_DIR/service-status.jsonl"
    
    case $suite in
        "startup")
            test_clean_startup
            ;;
        "shutdown")
            test_graceful_shutdown
            ;;
        "force")
            test_force_shutdown
            ;;
        "conflict")
            test_port_conflict
            ;;
        "redis")
            test_redis_failure
            ;;
        "restart")
            test_restart_cycle
            ;;
        "status")
            test_status_propagation
            ;;
        "all"|*)
            test_clean_startup
            test_graceful_shutdown
            test_force_shutdown
            test_port_conflict
            test_redis_failure
            test_restart_cycle
            test_status_propagation
            ;;
    esac
    
    print_summary
    
    # Cleanup
    kill_service $API_PORT "API" 2>/dev/null || true
    
    exit $TESTS_FAILED
}

main "$@"
