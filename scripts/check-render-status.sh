#!/bin/bash
# BlankLogo Render Deployment Status Checker
# Usage: ./scripts/check-render-status.sh [--poll]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Render API Key (set via environment or here)
RENDER_API_KEY="${RENDER_API_KEY:-rnd_FH1bNlIRM2LNWNrOK21mQFASMeBZ}"

# Polling settings
POLL_INTERVAL=10  # seconds
MAX_POLLS=60      # max attempts (10 minutes total)

check_services() {
    local json=$(curl -s -X GET "https://api.render.com/v1/services" \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Accept: application/json")
    
    echo "$json"
}

parse_status() {
    local json="$1"
    
    echo -e "\n${CYAN}════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  BlankLogo Render Deployment Status${NC}"
    echo -e "${CYAN}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════${NC}\n"
    
    # Parse each service
    local all_ready=true
    local has_failed=false
    
    # Redis
    local redis_status=$(echo "$json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data:
    if 'keyValue' in s and s['keyValue'].get('name') == 'blanklogo-redis':
        print(s['keyValue'].get('status', 'unknown'))
        break
" 2>/dev/null || echo "unknown")
    
    if [ "$redis_status" == "available" ]; then
        echo -e "  ${GREEN}✅${NC} blanklogo-redis     ${GREEN}$redis_status${NC}"
    else
        echo -e "  ${YELLOW}⏳${NC} blanklogo-redis     ${YELLOW}$redis_status${NC}"
        all_ready=false
    fi
    
    # API, Worker, Web
    for service in "blanklogo-api" "blanklogo-worker" "blanklogo-web"; do
        local status=$(echo "$json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data:
    if 'service' in s and s['service'].get('name') == '$service':
        # Check deploy status via API
        print('deployed')
        break
else:
    print('not_found')
" 2>/dev/null || echo "unknown")
        
        # Get actual deploy status
        local svc_id=$(echo "$json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data:
    if 'service' in s and s['service'].get('name') == '$service':
        print(s['service'].get('id', ''))
        break
" 2>/dev/null)
        
        if [ -n "$svc_id" ]; then
            local deploy_info=$(curl -s -X GET "https://api.render.com/v1/services/$svc_id/deploys?limit=1" \
                -H "Authorization: Bearer $RENDER_API_KEY" \
                -H "Accept: application/json" 2>/dev/null)
            
            local deploy_status=$(echo "$deploy_info" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data and len(data) > 0:
    status = data[0].get('deploy', {}).get('status', 'unknown')
    print(status)
else:
    print('no_deploys')
" 2>/dev/null || echo "unknown")
            
            case "$deploy_status" in
                "live")
                    echo -e "  ${GREEN}✅${NC} $service     ${GREEN}live${NC}"
                    ;;
                "build_in_progress"|"update_in_progress")
                    echo -e "  ${YELLOW}🔄${NC} $service     ${YELLOW}building${NC}"
                    all_ready=false
                    ;;
                "build_failed"|"update_failed"|"deactivated")
                    echo -e "  ${RED}❌${NC} $service     ${RED}$deploy_status${NC}"
                    has_failed=true
                    all_ready=false
                    ;;
                *)
                    echo -e "  ${YELLOW}⏳${NC} $service     ${YELLOW}$deploy_status${NC}"
                    all_ready=false
                    ;;
            esac
        else
            echo -e "  ${RED}❓${NC} $service     ${RED}not found${NC}"
            all_ready=false
        fi
    done
    
    echo ""
    
    if [ "$has_failed" = true ]; then
        echo -e "${RED}❌ Some services failed to deploy${NC}"
        echo -e "   Check logs: render logs -r <service-id>"
        return 2
    elif [ "$all_ready" = true ]; then
        echo -e "${GREEN}✅ All services are live!${NC}"
        echo ""
        echo -e "${BLUE}URLs:${NC}"
        echo -e "  API:    https://blanklogo-api.onrender.com/health"
        echo -e "  Web:    https://blanklogo-web.onrender.com"
        echo -e "  Worker: https://blanklogo-worker.onrender.com/health"
        return 0
    else
        echo -e "${YELLOW}⏳ Services still deploying...${NC}"
        return 1
    fi
}

# Main
echo -e "${BLUE}🔍 Checking Render deployment status...${NC}"

if [ "$1" == "--poll" ] || [ "$1" == "-p" ]; then
    echo -e "${BLUE}📡 Polling mode enabled (every ${POLL_INTERVAL}s, max ${MAX_POLLS} attempts)${NC}"
    
    for i in $(seq 1 $MAX_POLLS); do
        json=$(check_services)
        parse_status "$json"
        status=$?
        
        if [ $status -eq 0 ]; then
            echo -e "\n${GREEN}🎉 Deployment complete!${NC}"
            exit 0
        elif [ $status -eq 2 ]; then
            echo -e "\n${RED}Deployment failed. Check Render dashboard for logs.${NC}"
            exit 1
        fi
        
        echo -e "\n${BLUE}Checking again in ${POLL_INTERVAL}s... (attempt $i/$MAX_POLLS)${NC}"
        sleep $POLL_INTERVAL
    done
    
    echo -e "\n${YELLOW}⚠️ Timeout: Services still not ready after $((MAX_POLLS * POLL_INTERVAL))s${NC}"
    exit 1
else
    json=$(check_services)
    parse_status "$json"
fi
