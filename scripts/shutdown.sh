#!/bin/bash

# BlankLogo Shutdown Script
# Gracefully shuts down all services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
FRONTEND_PORT=${FRONTEND_PORT:-3939}
API_PORT=${API_PORT:-8989}

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           BlankLogo Shutdown Script                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")  echo -e "${BLUE}[$timestamp]${NC} ${GREEN}[INFO]${NC}  $message" ;;
        "WARN")  echo -e "${BLUE}[$timestamp]${NC} ${YELLOW}[WARN]${NC}  $message" ;;
        "ERROR") echo -e "${BLUE}[$timestamp]${NC} ${RED}[ERROR]${NC} $message" ;;
        *)       echo -e "${BLUE}[$timestamp]${NC} $message" ;;
    esac
}

# Kill process on port gracefully
kill_service() {
    local name=$1
    local port=$2
    
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        log "INFO" "Stopping $name on port $port..."
        
        # Try graceful shutdown first (SIGTERM)
        echo "$pids" | xargs kill -15 2>/dev/null || true
        sleep 2
        
        # Check if still running
        pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            log "WARN" "$name did not stop gracefully, forcing..."
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
        
        log "INFO" "✅ $name stopped"
    else
        log "INFO" "$name was not running on port $port"
    fi
}

# Kill all node processes related to BlankLogo
kill_blanklogo_processes() {
    log "INFO" "Cleaning up BlankLogo processes..."
    
    # Kill tsx watch processes
    pkill -f "tsx.*src/index.ts" 2>/dev/null || true
    pkill -f "tsx watch" 2>/dev/null || true
    
    # Kill next dev processes
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    
    sleep 1
}

# Main shutdown
main() {
    local mode=${1:-"all"}
    
    case $mode in
        "api")
            kill_service "API" $API_PORT
            ;;
        "frontend")
            kill_service "Frontend" $FRONTEND_PORT
            ;;
        "force")
            log "WARN" "Force killing all BlankLogo processes..."
            kill_blanklogo_processes
            kill_service "API" $API_PORT
            kill_service "Frontend" $FRONTEND_PORT
            ;;
        "all"|*)
            kill_service "Frontend" $FRONTEND_PORT
            kill_service "API" $API_PORT
            kill_blanklogo_processes
            ;;
    esac
    
    echo ""
    log "INFO" "╔════════════════════════════════════════════════════════╗"
    log "INFO" "║              Shutdown Complete                         ║"
    log "INFO" "╚════════════════════════════════════════════════════════╝"
    echo ""
}

main "$@"
