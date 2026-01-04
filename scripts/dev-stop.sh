#!/bin/bash
# =============================================================================
# BlankLogo - Development Stop Script
# Stops all development services gracefully
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/.logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "[INFO] $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo ""
echo "Stopping BlankLogo services..."
echo ""

# Stop by PID files
for service in api web worker; do
    pid_file="$LOG_DIR/$service.pid"
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping $service (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            log_success "$service stopped"
        fi
        rm -f "$pid_file"
    fi
done

# Kill any remaining processes on known ports
for port in 8989 3939; do
    pids=$(lsof -t -i ":$port" 2>/dev/null)
    if [ -n "$pids" ]; then
        log_warn "Killing process on port $port"
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
done

# Kill by process name patterns
pkill -f "tsx.*api" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "@blanklogo" 2>/dev/null || true

echo ""
log_success "All services stopped"
echo ""
