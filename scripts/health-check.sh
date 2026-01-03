#!/bin/bash
# BlankLogo Health Check Script
# Checks all services and reports status with error logging

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

echo "========================================"
echo "  BlankLogo System Health Check"
echo "  $(date)"
echo "========================================"
echo ""

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    printf "%-25s" "$name:"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null) || response="000"
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ Healthy${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $response, expected $expected_status)"
        echo "  └─ ERROR: $name is not responding correctly at $url" >&2
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Function to check Docker container
check_docker() {
    local name=$1
    local container=$2
    
    printf "%-25s" "$name:"
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo -e "${RED}✗ NOT RUNNING${NC}"
        echo "  └─ ERROR: Container $container is not running" >&2
        ERRORS=$((ERRORS + 1))
        return 1
    fi
    
    health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null) || health="unknown"
    
    case $health in
        "healthy")
            echo -e "${GREEN}✓ Healthy${NC}"
            return 0
            ;;
        "unhealthy")
            echo -e "${RED}✗ Unhealthy${NC}"
            echo "  └─ ERROR: Container $container is unhealthy" >&2
            # Get last health check log
            docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' "$container" 2>/dev/null | tail -1
            ERRORS=$((ERRORS + 1))
            return 1
            ;;
        "starting")
            echo -e "${YELLOW}⟳ Starting...${NC}"
            return 0
            ;;
        *)
            echo -e "${YELLOW}? Unknown ($health)${NC}"
            return 0
            ;;
    esac
}

# Function to check port
check_port() {
    local name=$1
    local port=$2
    
    printf "%-25s" "$name (port $port):"
    
    if lsof -i :$port -P -n | grep -q LISTEN; then
        echo -e "${GREEN}✓ Listening${NC}"
        return 0
    else
        echo -e "${RED}✗ NOT LISTENING${NC}"
        echo "  └─ ERROR: Nothing listening on port $port" >&2
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

echo "=== Application Services ==="
check_port "Frontend (Next.js)" 3838 || true
check_port "API Server" 8989 || true
echo ""

echo "=== HTTP Health Endpoints ==="
check_http "API Health" "http://localhost:8989/health" || true
check_http "Frontend" "http://localhost:3838" || true
check_http "Supabase API" "http://localhost:54351/rest/v1/" || true
echo ""

echo "=== Docker Containers (BlankLogo) ==="
check_docker "Supabase Kong" "supabase_kong_BlankLogo" || true
check_docker "Supabase Auth" "supabase_auth_BlankLogo" || true
check_docker "Supabase DB" "supabase_db_BlankLogo" || true
check_docker "Supabase Storage" "supabase_storage_BlankLogo" || true
check_docker "Supabase Studio" "supabase_studio_BlankLogo" || true
check_docker "Supabase Inbucket" "supabase_inbucket_BlankLogo" || true
echo ""

echo "=== Summary ==="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All systems healthy!${NC}"
    exit 0
else
    echo -e "${RED}$ERRORS error(s) detected!${NC}"
    echo ""
    echo "Troubleshooting commands:"
    echo "  - View logs: docker logs <container_name>"
    echo "  - Restart Supabase: pnpm db:start"
    echo "  - Restart API: pnpm --filter api dev"
    echo "  - Restart Frontend: pnpm --filter web dev"
    exit 1
fi
