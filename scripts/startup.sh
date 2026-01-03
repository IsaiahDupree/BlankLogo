#!/bin/bash

# BlankLogo Startup Script
# Handles starting all services with health checks and status reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_PORT=${FRONTEND_PORT:-3939}
API_PORT=${API_PORT:-8989}
REDIS_PORT=${REDIS_PORT:-6379}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Status tracking
declare -A SERVICE_STATUS

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           BlankLogo Startup Script                     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")  echo -e "${BLUE}[$timestamp]${NC} ${GREEN}[INFO]${NC}  $message" ;;
        "WARN")  echo -e "${BLUE}[$timestamp]${NC} ${YELLOW}[WARN]${NC}  $message" ;;
        "ERROR") echo -e "${BLUE}[$timestamp]${NC} ${RED}[ERROR]${NC} $message" ;;
        "CHECK") echo -e "${BLUE}[$timestamp]${NC} ${CYAN}[CHECK]${NC} $message" ;;
        *)       echo -e "${BLUE}[$timestamp]${NC} $message" ;;
    esac
}

# Check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port in use
    else
        return 1  # Port free
    fi
}

# Kill process on port
kill_port() {
    local port=$1
    log "WARN" "Killing existing process on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 1
}

# Wait for service to be ready
wait_for_service() {
    local name=$1
    local url=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    log "CHECK" "Waiting for $name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 2 "$url" >/dev/null 2>&1; then
            log "INFO" "✅ $name is ready!"
            SERVICE_STATUS[$name]="✅ Running"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    log "ERROR" "❌ $name failed to start after $max_attempts seconds"
    SERVICE_STATUS[$name]="❌ Failed"
    return 1
}

# Check Redis connectivity
check_redis() {
    log "CHECK" "Testing Redis connectivity..."
    
    if ! command -v redis-cli &> /dev/null; then
        log "WARN" "redis-cli not found, checking via port..."
        if check_port $REDIS_PORT; then
            log "INFO" "✅ Redis port $REDIS_PORT is open"
            SERVICE_STATUS["Redis"]="✅ Running (port open)"
            return 0
        else
            log "WARN" "Redis not running on port $REDIS_PORT"
            SERVICE_STATUS["Redis"]="⚠️ Not running"
            return 1
        fi
    fi
    
    if redis-cli -p $REDIS_PORT ping 2>/dev/null | grep -q "PONG"; then
        log "INFO" "✅ Redis is responding to PING"
        SERVICE_STATUS["Redis"]="✅ Connected"
        return 0
    else
        log "WARN" "Redis not responding"
        SERVICE_STATUS["Redis"]="❌ Not responding"
        return 1
    fi
}

# Start Redis if not running
start_redis() {
    log "INFO" "Checking Redis..."
    
    if check_redis; then
        return 0
    fi
    
    log "INFO" "Starting Redis..."
    
    # Try to start Redis
    if command -v redis-server &> /dev/null; then
        redis-server --daemonize yes --port $REDIS_PORT 2>/dev/null || true
        sleep 2
        check_redis
    else
        log "WARN" "redis-server not installed. Redis features may be limited."
        SERVICE_STATUS["Redis"]="⚠️ Not installed"
    fi
}

# Check Supabase
check_supabase() {
    log "CHECK" "Testing Supabase connectivity..."
    
    local supabase_url="http://127.0.0.1:54351/health"
    
    if curl -s --max-time 3 "$supabase_url" >/dev/null 2>&1; then
        log "INFO" "✅ Supabase is running"
        SERVICE_STATUS["Supabase"]="✅ Running"
        return 0
    else
        log "WARN" "Supabase not responding on port 54351"
        SERVICE_STATUS["Supabase"]="⚠️ Not running"
        return 1
    fi
}

# Start Supabase
start_supabase() {
    log "INFO" "Checking Supabase..."
    
    if check_supabase; then
        return 0
    fi
    
    log "INFO" "Starting Supabase..."
    cd "$PROJECT_ROOT"
    npx supabase start 2>&1 | while read line; do
        log "INFO" "[Supabase] $line"
    done &
    
    wait_for_service "Supabase" "http://127.0.0.1:54351/health" 60
}

# Start API server
start_api() {
    log "INFO" "Starting API server on port $API_PORT..."
    
    # Kill existing if needed
    if check_port $API_PORT; then
        kill_port $API_PORT
    fi
    
    cd "$PROJECT_ROOT/apps/api"
    PORT=$API_PORT npx tsx src/index.ts > /tmp/blanklogo-api.log 2>&1 &
    
    wait_for_service "API" "http://localhost:$API_PORT/health" 30
}

# Start Frontend
start_frontend() {
    log "INFO" "Starting Frontend on port $FRONTEND_PORT..."
    
    # Kill existing if needed
    if check_port $FRONTEND_PORT; then
        kill_port $FRONTEND_PORT
    fi
    
    cd "$PROJECT_ROOT/apps/web"
    PORT=$FRONTEND_PORT pnpm dev > /tmp/blanklogo-web.log 2>&1 &
    
    wait_for_service "Frontend" "http://localhost:$FRONTEND_PORT" 60
}

# Run interconnection tests
run_interconnection_tests() {
    echo ""
    log "CHECK" "═══════════════════════════════════════════════════════"
    log "CHECK" "Running Interconnection Tests..."
    log "CHECK" "═══════════════════════════════════════════════════════"
    
    local tests_passed=0
    local tests_failed=0
    
    # Test 1: API Health
    echo ""
    log "CHECK" "Test 1: API Health Check"
    local api_health=$(curl -s --max-time 5 "http://localhost:$API_PORT/health" 2>/dev/null)
    if [ -n "$api_health" ]; then
        log "INFO" "  ✅ API health endpoint responding"
        echo "     Response: $api_health"
        tests_passed=$((tests_passed + 1))
    else
        log "ERROR" "  ❌ API health endpoint failed"
        tests_failed=$((tests_failed + 1))
    fi
    
    # Test 2: API Status (comprehensive)
    echo ""
    log "CHECK" "Test 2: API Full Status"
    local api_status=$(curl -s --max-time 10 "http://localhost:$API_PORT/status" 2>/dev/null)
    if [ -n "$api_status" ]; then
        log "INFO" "  ✅ API status endpoint responding"
        echo "$api_status" | head -20
        tests_passed=$((tests_passed + 1))
    else
        log "ERROR" "  ❌ API status endpoint failed"
        tests_failed=$((tests_failed + 1))
    fi
    
    # Test 3: API Readiness
    echo ""
    log "CHECK" "Test 3: API Readiness Probe"
    local api_ready=$(curl -s --max-time 5 "http://localhost:$API_PORT/ready" 2>/dev/null)
    if echo "$api_ready" | grep -q '"ready":true'; then
        log "INFO" "  ✅ API is ready to accept traffic"
        tests_passed=$((tests_passed + 1))
    else
        log "WARN" "  ⚠️ API not fully ready: $api_ready"
        tests_failed=$((tests_failed + 1))
    fi
    
    # Test 4: Frontend
    echo ""
    log "CHECK" "Test 4: Frontend Accessibility"
    if curl -s --max-time 5 "http://localhost:$FRONTEND_PORT" | grep -q "BlankLogo\|html" 2>/dev/null; then
        log "INFO" "  ✅ Frontend is serving pages"
        tests_passed=$((tests_passed + 1))
    else
        log "ERROR" "  ❌ Frontend not responding"
        tests_failed=$((tests_failed + 1))
    fi
    
    # Test 5: Redis via API
    echo ""
    log "CHECK" "Test 5: Redis Connection via API"
    if echo "$api_status" | grep -q '"redis".*"connected":true'; then
        log "INFO" "  ✅ Redis connected via API"
        tests_passed=$((tests_passed + 1))
    else
        log "WARN" "  ⚠️ Redis not connected"
        tests_failed=$((tests_failed + 1))
    fi
    
    # Test 6: Supabase via API
    echo ""
    log "CHECK" "Test 6: Supabase Connection via API"
    if echo "$api_status" | grep -q '"supabase".*"connected":true'; then
        log "INFO" "  ✅ Supabase connected via API"
        tests_passed=$((tests_passed + 1))
    else
        log "WARN" "  ⚠️ Supabase not connected"
        tests_failed=$((tests_failed + 1))
    fi
    
    # Test 7: API Platforms endpoint
    echo ""
    log "CHECK" "Test 7: API Platforms Endpoint"
    local platforms=$(curl -s --max-time 5 "http://localhost:$API_PORT/api/v1/platforms" 2>/dev/null)
    if echo "$platforms" | grep -q "sora"; then
        log "INFO" "  ✅ Platforms endpoint working"
        tests_passed=$((tests_passed + 1))
    else
        log "ERROR" "  ❌ Platforms endpoint failed"
        tests_failed=$((tests_failed + 1))
    fi
    
    # Summary
    echo ""
    log "CHECK" "═══════════════════════════════════════════════════════"
    log "CHECK" "Test Summary: $tests_passed passed, $tests_failed failed"
    log "CHECK" "═══════════════════════════════════════════════════════"
    
    return $tests_failed
}

# Print status summary
print_status() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              Service Status Summary                    ║${NC}"
    echo -e "${CYAN}╠════════════════════════════════════════════════════════╣${NC}"
    
    for service in "${!SERVICE_STATUS[@]}"; do
        printf "${CYAN}║${NC}  %-12s ${SERVICE_STATUS[$service]}%*s${CYAN}║${NC}\n" "$service:" "" $((35 - ${#SERVICE_STATUS[$service]})) ""
    done
    
    echo -e "${CYAN}╠════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║  URLs:                                                 ║${NC}"
    echo -e "${CYAN}║    Frontend: http://localhost:$FRONTEND_PORT                     ║${NC}"
    echo -e "${CYAN}║    API:      http://localhost:$API_PORT                      ║${NC}"
    echo -e "${CYAN}║    Status:   http://localhost:$API_PORT/status               ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Main startup sequence
main() {
    local mode=${1:-"all"}
    
    case $mode in
        "redis")
            start_redis
            ;;
        "supabase")
            start_supabase
            ;;
        "api")
            start_api
            ;;
        "frontend")
            start_frontend
            ;;
        "test")
            run_interconnection_tests
            ;;
        "status")
            check_redis
            check_supabase
            wait_for_service "API" "http://localhost:$API_PORT/health" 5 || SERVICE_STATUS["API"]="❌ Not running"
            wait_for_service "Frontend" "http://localhost:$FRONTEND_PORT" 5 || SERVICE_STATUS["Frontend"]="❌ Not running"
            print_status
            ;;
        "all"|*)
            log "INFO" "Starting all services..."
            echo ""
            
            # Start services in order
            start_redis
            check_supabase || log "WARN" "Supabase not running - start with 'npx supabase start'"
            start_api
            start_frontend
            
            # Run tests
            run_interconnection_tests
            
            # Print summary
            print_status
            
            log "INFO" "Startup complete! Logs available in /tmp/blanklogo-*.log"
            ;;
    esac
}

# Handle shutdown
cleanup() {
    echo ""
    log "INFO" "Shutting down services..."
    
    # Kill services
    lsof -ti:$API_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    
    log "INFO" "Shutdown complete"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Run main
main "$@"
