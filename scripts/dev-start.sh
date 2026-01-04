#!/bin/bash
# =============================================================================
# BlankLogo - Development Startup Script
# Starts all services and waits for them to be healthy
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
API_PORT="${API_PORT:-8989}"
WEB_PORT="${WEB_PORT:-3939}"
LOG_DIR="$PROJECT_ROOT/.logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_header() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }

# Create log directory
mkdir -p "$LOG_DIR"

# Check if port is in use
check_port() {
    local port=$1
    lsof -i ":$port" > /dev/null 2>&1
    return $?
}

# Kill process on port
kill_port() {
    local port=$1
    local pids=$(lsof -t -i ":$port" 2>/dev/null)
    if [ -n "$pids" ]; then
        log_warn "Killing existing process on port $port (PIDs: $pids)"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Wait for service to be ready
wait_for_ready() {
    local url=$1
    local name=$2
    local max_wait=${3:-60}
    local start_time=$(date +%s)
    
    log_info "Waiting for $name to be ready..."
    
    while true; do
        if curl -sf "$url" > /dev/null 2>&1; then
            local elapsed=$(($(date +%s) - start_time))
            log_success "$name is ready! (${elapsed}s)"
            return 0
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        if [ $elapsed -ge $max_wait ]; then
            log_error "$name failed to start within ${max_wait}s"
            return 1
        fi
        
        sleep 1
    done
}

# Start API service
start_api() {
    log_header "Starting API Service"
    
    if check_port $API_PORT; then
        log_warn "Port $API_PORT already in use"
        read -p "Kill existing process? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill_port $API_PORT
        else
            log_info "Using existing API service"
            return 0
        fi
    fi
    
    log_info "Starting API on port $API_PORT..."
    cd "$PROJECT_ROOT"
    pnpm --filter @blanklogo/api dev > "$LOG_DIR/api.log" 2>&1 &
    echo $! > "$LOG_DIR/api.pid"
    log_info "API PID: $(cat $LOG_DIR/api.pid)"
    
    if ! wait_for_ready "http://localhost:$API_PORT/health" "API" 30; then
        log_error "API failed to start. Check logs: $LOG_DIR/api.log"
        tail -20 "$LOG_DIR/api.log"
        return 1
    fi
}

# Start Web service
start_web() {
    log_header "Starting Web Service"
    
    if check_port $WEB_PORT; then
        log_warn "Port $WEB_PORT already in use"
        read -p "Kill existing process? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill_port $WEB_PORT
        else
            log_info "Using existing Web service"
            return 0
        fi
    fi
    
    log_info "Starting Web on port $WEB_PORT..."
    cd "$PROJECT_ROOT"
    pnpm --filter @blanklogo/web dev > "$LOG_DIR/web.log" 2>&1 &
    echo $! > "$LOG_DIR/web.pid"
    log_info "Web PID: $(cat $LOG_DIR/web.pid)"
    
    if ! wait_for_ready "http://localhost:$WEB_PORT" "Web" 60; then
        log_error "Web failed to start. Check logs: $LOG_DIR/web.log"
        tail -20 "$LOG_DIR/web.log"
        return 1
    fi
}

# Print status
print_status() {
    log_header "Service Status"
    
    echo "┌─────────────────────────────────────────────┐"
    echo "│           BlankLogo Dev Environment         │"
    echo "├─────────────────────────────────────────────┤"
    
    # API Status
    if curl -sf "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
        echo -e "│  API:  ${GREEN}● Running${NC}  http://localhost:$API_PORT    │"
    else
        echo -e "│  API:  ${RED}○ Stopped${NC}                            │"
    fi
    
    # Web Status
    if curl -sf "http://localhost:$WEB_PORT" > /dev/null 2>&1; then
        echo -e "│  Web:  ${GREEN}● Running${NC}  http://localhost:$WEB_PORT    │"
    else
        echo -e "│  Web:  ${RED}○ Stopped${NC}                            │"
    fi
    
    echo "├─────────────────────────────────────────────┤"
    echo "│  Logs: $LOG_DIR/                │"
    echo "│  Stop: ./scripts/dev-stop.sh               │"
    echo "└─────────────────────────────────────────────┘"
}

# Main
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║        BlankLogo Development Startup          ║"
    echo "╚═══════════════════════════════════════════════╝"
    
    local failed=0
    
    start_api || failed=1
    start_web || failed=1
    
    if [ $failed -eq 0 ]; then
        print_status
        log_success "All services started successfully!"
        echo ""
        log_info "Run tests with: pnpm test:e2e"
        echo ""
    else
        log_error "Some services failed to start"
        exit 1
    fi
}

main "$@"
