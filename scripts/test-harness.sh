#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# BlankLogo Service Test Harness
# Tests start/stop + failure modes across API and Worker services
# Implements structured logging with status snapshots
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration
RUN_ID="testrun-$(date +%Y%m%d-%H%M%S)"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$PROJECT_ROOT/testruns/$RUN_ID"
mkdir -p "$OUT_DIR"

# Service URLs
API_PORT=${API_PORT:-8989}
WORKER_PORT=${WORKER_PORT:-8990}
REDIS_PORT=${REDIS_PORT:-6379}

API_HEALTHZ="http://localhost:$API_PORT/healthz"
API_READYZ="http://localhost:$API_PORT/readyz"
API_CAPABILITIES="http://localhost:$API_PORT/capabilities"
WORKER_HEALTHZ="http://localhost:$WORKER_PORT/healthz"
WORKER_READYZ="http://localhost:$WORKER_PORT/readyz"
WORKER_CAPABILITIES="http://localhost:$WORKER_PORT/capabilities"

# Log files
API_LOG="$OUT_DIR/api.log"
WORKER_LOG="$OUT_DIR/worker.log"
HARNESS_LOG="$OUT_DIR/harness.log"
STATUS_LOG="$OUT_DIR/status_snapshots.jsonl"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'

# Test tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo ""
echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║           BlankLogo Service Test Harness                              ║${NC}"
echo -e "${MAGENTA}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${MAGENTA}║  Run ID: $RUN_ID                                      ║${NC}"
echo -e "${MAGENTA}║  Output: $OUT_DIR${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

log() {
    local level=$1
    local message=$2
    local ts=$(date -Iseconds)
    
    case $level in
        "INFO")   echo -e "${BLUE}[$ts]${NC} ${WHITE}[INFO]${NC}   $message" ;;
        "PASS")   echo -e "${BLUE}[$ts]${NC} ${GREEN}[PASS]${NC}   $message" ;;
        "FAIL")   echo -e "${BLUE}[$ts]${NC} ${RED}[FAIL]${NC}   $message" ;;
        "WARN")   echo -e "${BLUE}[$ts]${NC} ${YELLOW}[WARN]${NC}   $message" ;;
        "TEST")   echo -e "${BLUE}[$ts]${NC} ${CYAN}[TEST]${NC}   $message" ;;
        "ITER")   echo -e "${BLUE}[$ts]${NC} ${MAGENTA}[ITER]${NC}   $message" ;;
        *)        echo -e "[$ts] $message" ;;
    esac
    
    echo "[$ts] [$level] $message" >> "$HARNESS_LOG"
}

log_section() {
    echo "" | tee -a "$HARNESS_LOG"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}" | tee -a "$HARNESS_LOG"
    log "ITER" "$1"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}" | tee -a "$HARNESS_LOG"
}

curl_code() {
    # Returns HTTP status code or 000 if unreachable
    curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$1" 2>/dev/null || echo "000"
}

curl_json() {
    # Returns JSON response or empty object
    curl -s --max-time 3 "$1" 2>/dev/null || echo "{}"
}

snapshot_status() {
    local label="$1"
    local api_h api_r api_c
    local api_state api_version api_protocol
    
    api_h="$(curl_code "$API_HEALTHZ")"
    api_r="$(curl_code "$API_READYZ")"
    api_c="$(curl_code "$API_CAPABILITIES")"
    
    # Get state from healthz response
    api_state="$(curl_json "$API_HEALTHZ" | grep -o '"state":"[^"]*"' | cut -d'"' -f4 || echo "unknown")"
    
    # Get capabilities info
    local caps_json="$(curl_json "$API_CAPABILITIES")"
    api_version="$(echo "$caps_json" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")"
    api_protocol="$(echo "$caps_json" | grep -o '"version":[0-9]*' | head -1 | cut -d':' -f2 || echo "0")"
    local api_run_id="$(echo "$caps_json" | grep -o '"run_id":"[^"]*"' | cut -d'"' -f4 || echo "unknown")"
    
    # Redis check
    local redis_up="false"
    if nc -z localhost $REDIS_PORT 2>/dev/null; then
        redis_up="true"
    fi
    
    local snapshot="{\"ts\":\"$(date -Iseconds)\",\"label\":\"$label\",\"harness_run_id\":\"$RUN_ID\",\"api_healthz\":$api_h,\"api_readyz\":$api_r,\"api_capabilities\":$api_c,\"api_state\":\"$api_state\",\"api_run_id\":\"$api_run_id\",\"api_version\":\"$api_version\",\"api_protocol\":$api_protocol,\"redis_up\":$redis_up}"
    
    echo "$snapshot" >> "$STATUS_LOG"
    log "INFO" "Status: healthz=$api_h readyz=$api_r caps=$api_c state=$api_state run_id=$api_run_id"
}

tail_logs() {
    local label="$1"
    echo -e "\n--- LOG SNAPSHOT: $label ---" >> "$HARNESS_LOG"
    
    if [[ -f "$API_LOG" ]]; then
        echo "[api last 20 lines]" >> "$HARNESS_LOG"
        tail -n 20 "$API_LOG" >> "$HARNESS_LOG" 2>/dev/null || true
    fi
}

wait_for_ready() {
    local name="$1"
    local url="$2"
    local timeout_s="${3:-30}"
    local start_ts=$(date +%s)
    
    log "INFO" "Waiting for $name to be ready (timeout: ${timeout_s}s)..."
    
    while true; do
        local code=$(curl_code "$url")
        if [[ "$code" == "200" ]]; then
            log "PASS" "$name is ready"
            return 0
        fi
        
        local now=$(date +%s)
        if (( now - start_ts > timeout_s )); then
            log "FAIL" "$name ready timeout (last code=$code)"
            return 1
        fi
        sleep 1
    done
}

wait_for_down() {
    local name="$1"
    local url="$2"
    local timeout_s="${3:-10}"
    local start_ts=$(date +%s)
    
    log "INFO" "Waiting for $name to stop..."
    
    while true; do
        local code=$(curl_code "$url")
        if [[ "$code" == "000" ]]; then
            log "PASS" "$name is stopped"
            return 0
        fi
        
        local now=$(date +%s)
        if (( now - start_ts > timeout_s )); then
            log "WARN" "$name still responding (code=$code)"
            return 1
        fi
        sleep 1
    done
}

# ═══════════════════════════════════════════════════════════════════════════════
# SERVICE CONTROL FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

start_api() {
    log "INFO" "Starting API server..."
    cd "$PROJECT_ROOT/apps/api"
    PORT=$API_PORT npx tsx src/index.ts >> "$API_LOG" 2>&1 &
    echo $! > "$OUT_DIR/api.pid"
    sleep 3
}

stop_api() {
    log "INFO" "Stopping API server (SIGTERM)..."
    if [[ -f "$OUT_DIR/api.pid" ]]; then
        local pid=$(cat "$OUT_DIR/api.pid")
        kill -15 "$pid" 2>/dev/null || true
        rm -f "$OUT_DIR/api.pid"
    fi
    # Also kill by port
    lsof -ti:$API_PORT 2>/dev/null | xargs kill -15 2>/dev/null || true
    sleep 2
}

kill_api() {
    log "WARN" "Force killing API server (SIGKILL)..."
    if [[ -f "$OUT_DIR/api.pid" ]]; then
        local pid=$(cat "$OUT_DIR/api.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$OUT_DIR/api.pid"
    fi
    lsof -ti:$API_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1
}

stop_redis() {
    log "INFO" "Stopping Redis..."
    redis-cli -p $REDIS_PORT shutdown nosave 2>/dev/null || true
    sleep 1
}

start_redis() {
    log "INFO" "Starting Redis..."
    redis-server --port $REDIS_PORT --daemonize yes 2>/dev/null || log "WARN" "Redis may already be running"
    sleep 2
}

# ═══════════════════════════════════════════════════════════════════════════════
# TEST ITERATIONS
# ═══════════════════════════════════════════════════════════════════════════════

run_test() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [[ "$actual" == "$expected" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        log "PASS" "✅ $name (expected=$expected, got=$actual)"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        log "FAIL" "❌ $name (expected=$expected, got=$actual)"
        return 1
    fi
}

# Iteration 1: Baseline check
iteration_1_baseline() {
    log_section "ITERATION 1: Baseline Check"
    
    snapshot_status "baseline_before"
    
    local api_h=$(curl_code "$API_HEALTHZ")
    local api_r=$(curl_code "$API_READYZ")
    
    if [[ "$api_h" == "200" ]]; then
        log "INFO" "API is running"
        run_test "API healthz returns 200" "200" "$api_h" || true
        
        # Check state
        local state=$(curl_json "$API_HEALTHZ" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
        log "INFO" "API state: $state"
    else
        log "WARN" "API not running, will start in later iterations"
    fi
    
    tail_logs "baseline"
}

# Iteration 2: Stop both services
iteration_2_stop_both() {
    log_section "ITERATION 2: Stop All Services"
    
    stop_api
    sleep 2
    
    snapshot_status "after_stop_both"
    
    local api_h=$(curl_code "$API_HEALTHZ")
    run_test "API stopped (healthz=000)" "000" "$api_h" || true
    
    # Check logs for STOPPING event
    if grep -q '"event":"STOPPING"' "$API_LOG" 2>/dev/null; then
        log "PASS" "API logged STOPPING event"
    else
        log "WARN" "STOPPING event not found in logs"
    fi
    
    tail_logs "after_stop_both"
}

# Iteration 3: Start API only (without Redis if possible)
iteration_3_start_api_only() {
    log_section "ITERATION 3: Start API Only"
    
    start_api
    sleep 4
    
    snapshot_status "api_only_early"
    
    local api_h=$(curl_code "$API_HEALTHZ")
    local api_r=$(curl_code "$API_READYZ")
    
    run_test "API healthz returns 200" "200" "$api_h" || true
    
    # Check state - should be starting or degraded if deps not ready
    local state=$(curl_json "$API_HEALTHZ" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    log "INFO" "API state after start: $state"
    
    # Check for STARTING event in logs
    if grep -q '"event":"STARTING"' "$API_LOG" 2>/dev/null; then
        log "PASS" "API logged STARTING event"
    fi
    
    tail_logs "api_only"
}

# Iteration 4: Stop API
iteration_4_stop_api() {
    log_section "ITERATION 4: Stop API"
    
    stop_api
    wait_for_down "API" "$API_HEALTHZ" 10 || true
    
    snapshot_status "after_stop_api"
    
    local api_h=$(curl_code "$API_HEALTHZ")
    run_test "API stopped" "000" "$api_h" || true
    
    tail_logs "after_stop_api"
}

# Iteration 5: Start API with all deps
iteration_5_start_with_deps() {
    log_section "ITERATION 5: Start API with Dependencies"
    
    # Ensure Redis is up
    if ! nc -z localhost $REDIS_PORT 2>/dev/null; then
        start_redis
    fi
    
    start_api
    wait_for_ready "API" "$API_READYZ" 30 || true
    
    snapshot_status "api_with_deps"
    
    local api_h=$(curl_code "$API_HEALTHZ")
    local api_r=$(curl_code "$API_READYZ")
    local state=$(curl_json "$API_HEALTHZ" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    
    run_test "API healthz returns 200" "200" "$api_h" || true
    run_test "API readyz returns 200" "200" "$api_r" || true
    run_test "API state is ready" "ready" "$state" || true
    
    tail_logs "api_with_deps"
}

# Iteration 6: Kill API (SIGKILL) - crash simulation
iteration_6_crash_api() {
    log_section "ITERATION 6: Crash API (SIGKILL)"
    
    # First ensure API is running
    local api_h=$(curl_code "$API_HEALTHZ")
    if [[ "$api_h" != "200" ]]; then
        start_api
        sleep 4
    fi
    
    snapshot_status "before_crash"
    
    kill_api
    sleep 2
    
    snapshot_status "after_crash"
    
    local api_h=$(curl_code "$API_HEALTHZ")
    run_test "API crashed (healthz=000)" "000" "$api_h" || true
    
    # Note: SIGKILL doesn't allow graceful shutdown logging
    log "INFO" "SIGKILL sent - no graceful shutdown logs expected"
    
    tail_logs "after_crash"
}

# Iteration 7: Restart after crash
iteration_7_restart_after_crash() {
    log_section "ITERATION 7: Restart After Crash"
    
    start_api
    wait_for_ready "API" "$API_READYZ" 30 || true
    
    snapshot_status "after_restart"
    
    local api_h=$(curl_code "$API_HEALTHZ")
    local state=$(curl_json "$API_HEALTHZ" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    
    run_test "API recovered" "200" "$api_h" || true
    
    # Check for new run_id (different from before crash)
    local run_id=$(curl_json "$API_HEALTHZ" | grep -o '"run_id":"[^"]*"' | cut -d'"' -f4)
    log "INFO" "New run_id after restart: $run_id"
    
    tail_logs "after_restart"
}

# Iteration 8: Port conflict test
iteration_8_port_conflict() {
    log_section "ITERATION 8: Port Conflict Test"
    
    # Ensure API is running
    local api_h=$(curl_code "$API_HEALTHZ")
    if [[ "$api_h" != "200" ]]; then
        start_api
        sleep 4
    fi
    
    snapshot_status "before_conflict"
    
    # Try to start second instance
    log "INFO" "Attempting to start second API instance on same port..."
    cd "$PROJECT_ROOT/apps/api"
    PORT=$API_PORT npx tsx src/index.ts >> "$OUT_DIR/api_conflict.log" 2>&1 &
    local conflict_pid=$!
    sleep 5
    
    # Check if second instance crashed
    if ! kill -0 $conflict_pid 2>/dev/null; then
        log "PASS" "Second instance failed to start (port conflict handled)"
        
        # Check for CRASH event in conflict log
        if grep -q 'EADDRINUSE\|already in use' "$OUT_DIR/api_conflict.log" 2>/dev/null; then
            log "PASS" "Port conflict error logged"
        fi
    else
        log "WARN" "Second instance may have started unexpectedly"
        kill -9 $conflict_pid 2>/dev/null || true
    fi
    
    snapshot_status "after_conflict"
    tail_logs "port_conflict"
}

# Iteration 9: Dependency down simulation
iteration_9_dependency_down() {
    log_section "ITERATION 9: Dependency Down Simulation"
    
    # Ensure API is running and ready
    local api_r=$(curl_code "$API_READYZ")
    if [[ "$api_r" != "200" ]]; then
        start_api
        wait_for_ready "API" "$API_READYZ" 30 || true
    fi
    
    snapshot_status "before_dep_down"
    
    # Stop Redis to simulate dependency down
    log "INFO" "Stopping Redis to simulate dependency failure..."
    stop_redis
    sleep 2
    
    # Poll readyz - should fail now
    local api_r=$(curl_code "$API_READYZ")
    local state=$(curl_json "$API_HEALTHZ" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    
    snapshot_status "redis_down"
    
    log "INFO" "API state with Redis down: $state"
    run_test "API readyz fails when Redis down" "503" "$api_r" || true
    
    # Check for DEPENDENCY_DOWN event
    if grep -q '"event":"DEPENDENCY_DOWN"' "$API_LOG" 2>/dev/null; then
        log "PASS" "DEPENDENCY_DOWN event logged"
    fi
    
    tail_logs "dep_down"
}

# Iteration 10: Dependency restored
iteration_10_dependency_restored() {
    log_section "ITERATION 10: Dependency Restored"
    
    # Start Redis back up
    start_redis
    sleep 3
    
    # Poll readyz a few times to trigger state transition
    for i in 1 2 3; do
        curl_code "$API_READYZ" > /dev/null
        sleep 1
    done
    
    local api_r=$(curl_code "$API_READYZ")
    local state=$(curl_json "$API_HEALTHZ" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    
    snapshot_status "redis_restored"
    
    log "INFO" "API state with Redis restored: $state"
    run_test "API readyz succeeds when Redis up" "200" "$api_r" || true
    
    # Check for DEPENDENCY_UP event
    if grep -q '"event":"DEPENDENCY_UP"' "$API_LOG" 2>/dev/null; then
        log "PASS" "DEPENDENCY_UP event logged"
    fi
    
    tail_logs "dep_restored"
}

# Iteration 11: Capabilities check
iteration_11_capabilities_check() {
    log_section "ITERATION 11: Capabilities Check"
    
    # Ensure API is running
    local api_h=$(curl_code "$API_HEALTHZ")
    if [[ "$api_h" != "200" ]]; then
        start_api
        wait_for_ready "API" "$API_READYZ" 30 || true
    fi
    
    snapshot_status "caps_check"
    
    # Test 1: Capabilities endpoint returns 200
    local caps_code=$(curl_code "$API_CAPABILITIES")
    run_test "Capabilities endpoint returns 200" "200" "$caps_code" || true
    
    # Test 2: Capabilities has required schema
    local caps_json=$(curl_json "$API_CAPABILITIES")
    
    local has_schema=$(echo "$caps_json" | grep -c '"schema":"capabilities/v1"' || echo "0")
    run_test "Capabilities has schema field" "1" "$has_schema" || true
    
    # Test 3: Has service name
    local has_service=$(echo "$caps_json" | grep -c '"service":"api"' || echo "0")
    run_test "Capabilities has service field" "1" "$has_service" || true
    
    # Test 4: Has run_id (changes each boot)
    local has_run_id=$(echo "$caps_json" | grep -c '"run_id":"api-' || echo "0")
    run_test "Capabilities has run_id field" "1" "$has_run_id" || true
    
    # Test 5: Has build version
    local has_version=$(echo "$caps_json" | grep -c '"version":' || echo "0")
    if [[ "$has_version" -gt 0 ]]; then
        log "PASS" "✅ Capabilities has version info"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log "FAIL" "❌ Capabilities missing version info"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Test 6: Has protocol version
    local has_protocol=$(echo "$caps_json" | grep -c '"protocol":' || echo "0")
    run_test "Capabilities has protocol field" "1" "$has_protocol" || true
    
    # Test 7: Has features
    local has_features=$(echo "$caps_json" | grep -c '"features":' || echo "0")
    run_test "Capabilities has features field" "1" "$has_features" || true
    
    # Test 8: Has endpoints
    local has_endpoints=$(echo "$caps_json" | grep -c '"endpoints":' || echo "0")
    run_test "Capabilities has endpoints field" "1" "$has_endpoints" || true
    
    # Test 9: Has dependencies
    local has_deps=$(echo "$caps_json" | grep -c '"dependencies":' || echo "0")
    run_test "Capabilities has dependencies field" "1" "$has_deps" || true
    
    # Test 10: Has limits
    local has_limits=$(echo "$caps_json" | grep -c '"limits":' || echo "0")
    run_test "Capabilities has limits field" "1" "$has_limits" || true
    
    # Log capabilities for verification
    log "INFO" "Full capabilities response:"
    echo "$caps_json" | head -50 >> "$HARNESS_LOG"
    
    # Check for CAPABILITIES_ANNOUNCED event in logs
    if grep -q '"event":"CAPABILITIES_ANNOUNCED"' "$API_LOG" 2>/dev/null; then
        log "PASS" "CAPABILITIES_ANNOUNCED event found in logs"
    else
        log "WARN" "CAPABILITIES_ANNOUNCED event not found (may have been before log capture)"
    fi
    
    tail_logs "caps_check"
}

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY & CLEANUP
# ═══════════════════════════════════════════════════════════════════════════════

print_summary() {
    echo ""
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║                        TEST SUMMARY                                   ║${NC}"
    echo -e "${MAGENTA}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${MAGENTA}║  Run ID:       ${WHITE}$RUN_ID${MAGENTA}                                      ║${NC}"
    echo -e "${MAGENTA}║  Tests Run:    ${WHITE}$TESTS_RUN${MAGENTA}                                                         ║${NC}"
    echo -e "${MAGENTA}║  Passed:       ${GREEN}$TESTS_PASSED${MAGENTA}                                                         ║${NC}"
    echo -e "${MAGENTA}║  Failed:       ${RED}$TESTS_FAILED${MAGENTA}                                                         ║${NC}"
    echo -e "${MAGENTA}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${MAGENTA}║  Output Directory: $OUT_DIR${NC}"
    echo -e "${MAGENTA}║  Status Snapshots: $STATUS_LOG${NC}"
    echo -e "${MAGENTA}║  Harness Log:      $HARNESS_LOG${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Print recent status snapshots
    echo -e "${CYAN}Recent Status Snapshots:${NC}"
    tail -5 "$STATUS_LOG" 2>/dev/null | while read line; do
        echo "  $line"
    done
    
    echo ""
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log "PASS" "All tests passed!"
    else
        log "FAIL" "$TESTS_FAILED tests failed - check logs for details"
    fi
}

cleanup() {
    log "INFO" "Cleaning up..."
    stop_api 2>/dev/null || true
    # Don't stop Redis by default - user may need it
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    local mode=${1:-"all"}
    
    trap cleanup EXIT
    
    case $mode in
        "baseline"|"1")
            iteration_1_baseline
            ;;
        "stop"|"2")
            iteration_2_stop_both
            ;;
        "start"|"3")
            iteration_3_start_api_only
            ;;
        "crash"|"6")
            iteration_6_crash_api
            ;;
        "conflict"|"8")
            iteration_8_port_conflict
            ;;
        "depdown"|"9")
            iteration_9_dependency_down
            ;;
        "depup"|"10")
            iteration_10_dependency_restored
            ;;
        "quick")
            iteration_1_baseline
            iteration_3_start_api_only
            iteration_5_start_with_deps
            ;;
        "all"|*)
            iteration_1_baseline
            iteration_2_stop_both
            iteration_3_start_api_only
            iteration_4_stop_api
            iteration_5_start_with_deps
            iteration_6_crash_api
            iteration_7_restart_after_crash
            iteration_8_port_conflict
            iteration_9_dependency_down
            iteration_10_dependency_restored
            iteration_11_capabilities_check
            ;;
        "caps"|"11")
            iteration_11_capabilities_check
            ;;
    esac
    
    print_summary
    
    exit $TESTS_FAILED
}

main "$@"
