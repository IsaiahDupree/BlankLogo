#!/bin/bash
# =============================================================================
# BlankLogo - Wait for Services Script
# Waits for all required services to be healthy before proceeding
# =============================================================================

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8989}"
WEB_URL="${WEB_URL:-http://localhost:3939}"
MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-2}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if a URL is responding
check_url() {
    local url=$1
    local name=$2
    curl -sf "$url" > /dev/null 2>&1
    return $?
}

# Wait for a service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local health_endpoint=$3
    local retries=0
    
    log_info "Waiting for $name at $url$health_endpoint..."
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if check_url "$url$health_endpoint" "$name"; then
            log_success "$name is ready!"
            return 0
        fi
        
        retries=$((retries + 1))
        if [ $retries -lt $MAX_RETRIES ]; then
            echo -n "."
            sleep $RETRY_INTERVAL
        fi
    done
    
    echo ""
    log_error "$name failed to respond after $MAX_RETRIES attempts"
    return 1
}

# Check API health details
check_api_health() {
    local response
    response=$(curl -sf "$API_URL/health" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "$response" | grep -q '"status":"healthy"' && return 0
    fi
    return 1
}

# Main execution
main() {
    echo ""
    echo "============================================"
    echo "  BlankLogo Service Health Check"
    echo "============================================"
    echo ""
    
    local failed=0
    
    # Check API
    if ! wait_for_service "$API_URL" "API Server" "/health"; then
        failed=1
    fi
    
    # Check Web
    if ! wait_for_service "$WEB_URL" "Web Server" ""; then
        failed=1
    fi
    
    echo ""
    
    if [ $failed -eq 0 ]; then
        echo "============================================"
        log_success "All services are healthy!"
        echo "============================================"
        
        # Print service details
        echo ""
        log_info "Service URLs:"
        echo "  - API: $API_URL"
        echo "  - Web: $WEB_URL"
        echo ""
        
        # Check API detailed status
        if check_api_health; then
            log_info "API Status: healthy"
            # Get queue stats if available
            local status=$(curl -sf "$API_URL/status" 2>/dev/null)
            if [ -n "$status" ]; then
                echo "$status" | grep -o '"redis":{[^}]*}' | head -1 || true
            fi
        fi
        
        return 0
    else
        echo "============================================"
        log_error "Some services failed to start!"
        echo "============================================"
        echo ""
        log_info "Troubleshooting:"
        echo "  1. Check if services are running: lsof -i :8989 -i :3939"
        echo "  2. Start services: pnpm dev"
        echo "  3. Check logs in each service directory"
        echo ""
        return 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
