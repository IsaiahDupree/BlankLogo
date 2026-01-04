#!/bin/bash
# BlankLogo Railway Deployment Script
# Run this after upgrading to Railway Pro

set -e

echo "🚀 BlankLogo Railway Deployment"
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found. Install with: brew install railway${NC}"
    exit 1
fi

# Check login status
echo -e "\n${BLUE}📋 Checking Railway login...${NC}"
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in. Running login...${NC}"
    railway login
fi

RAILWAY_USER=$(railway whoami 2>&1)
echo -e "${GREEN}✓ Logged in as: $RAILWAY_USER${NC}"

# Get or create project
echo -e "\n${BLUE}📋 Checking project link...${NC}"
if ! railway status &> /dev/null; then
    echo -e "${YELLOW}⚠️  No project linked. Creating new project...${NC}"
    railway init
fi

PROJECT_STATUS=$(railway status 2>&1)
echo -e "${GREEN}✓ Project linked${NC}"
echo "$PROJECT_STATUS"

# Prompt for Supabase credentials
echo -e "\n${BLUE}🔐 Enter your Supabase credentials:${NC}"
read -p "SUPABASE_URL: " SUPABASE_URL
read -p "SUPABASE_SERVICE_KEY: " SUPABASE_SERVICE_KEY
read -p "SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY

# Step 1: Add Redis
echo -e "\n${BLUE}📦 Step 1: Adding Redis...${NC}"
railway add -d redis 2>/dev/null || echo -e "${YELLOW}Redis may already exist${NC}"
echo -e "${GREEN}✓ Redis ready${NC}"

# Step 2: Create API Service
echo -e "\n${BLUE}📦 Step 2: Creating API service...${NC}"
railway add -s blanklogo-api \
    -v "PORT=8989" \
    -v "NODE_ENV=production" \
    -v "SUPABASE_URL=$SUPABASE_URL" \
    -v "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" \
    -v "CORS_ORIGINS=*" 2>/dev/null || echo -e "${YELLOW}API service may already exist${NC}"

# Link Redis URL to API
echo -e "${BLUE}   Linking Redis to API...${NC}"
railway variables -s blanklogo-api set 'REDIS_URL=${{Redis.REDIS_URL}}' 2>/dev/null || true
echo -e "${GREEN}✓ API service created${NC}"

# Step 3: Create Worker Service
echo -e "\n${BLUE}📦 Step 3: Creating Worker service...${NC}"
railway add -s blanklogo-worker \
    -v "WORKER_ID=worker-1" \
    -v "WORKER_CONCURRENCY=2" \
    -v "NODE_ENV=production" \
    -v "SUPABASE_URL=$SUPABASE_URL" \
    -v "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" 2>/dev/null || echo -e "${YELLOW}Worker service may already exist${NC}"

railway variables -s blanklogo-worker set 'REDIS_URL=${{Redis.REDIS_URL}}' 2>/dev/null || true
echo -e "${GREEN}✓ Worker service created${NC}"

# Step 4: Create Web Service
echo -e "\n${BLUE}📦 Step 4: Creating Web service...${NC}"
railway add -s blanklogo-web \
    -v "PORT=3939" \
    -v "NODE_ENV=production" \
    -v "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL" \
    -v "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" 2>/dev/null || echo -e "${YELLOW}Web service may already exist${NC}"
echo -e "${GREEN}✓ Web service created${NC}"

# Step 5: Deploy services
echo -e "\n${BLUE}🚀 Step 5: Deploying services...${NC}"

echo -e "${BLUE}   Deploying API...${NC}"
cd apps/api
railway up -s blanklogo-api --detach
cd ../..

echo -e "${BLUE}   Deploying Worker...${NC}"
cd apps/worker
railway up -s blanklogo-worker --detach
cd ../..

echo -e "${BLUE}   Deploying Web...${NC}"
cd apps/web
railway up -s blanklogo-web --detach
cd ../..

echo -e "${GREEN}✓ All services deploying${NC}"

# Step 6: Generate domains
echo -e "\n${BLUE}🌐 Step 6: Generating public domains...${NC}"
railway domain -s blanklogo-api 2>/dev/null || true
railway domain -s blanklogo-web 2>/dev/null || true

# Get URLs
echo -e "\n${BLUE}📋 Getting deployment URLs...${NC}"
API_URL=$(railway service -s blanklogo-api 2>/dev/null | grep -o 'https://[^ ]*' | head -1 || echo "pending...")
WEB_URL=$(railway service -s blanklogo-web 2>/dev/null | grep -o 'https://[^ ]*' | head -1 || echo "pending...")

echo -e "\n${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e ""
echo -e "📦 Services:"
echo -e "   ${BLUE}API:${NC}    $API_URL"
echo -e "   ${BLUE}Web:${NC}    $WEB_URL"
echo -e "   ${BLUE}Worker:${NC} (background service)"
echo -e "   ${BLUE}Redis:${NC}  (internal)"
echo -e ""
echo -e "🔍 Check status:  ${YELLOW}railway status${NC}"
echo -e "📜 View logs:     ${YELLOW}railway logs -s blanklogo-api${NC}"
echo -e "🌐 Open dashboard: ${YELLOW}railway open${NC}"
echo -e ""
echo -e "${YELLOW}⚠️  Note: Update NEXT_PUBLIC_API_URL in web service to API URL${NC}"
echo -e "   Run: railway variables -s blanklogo-web set NEXT_PUBLIC_API_URL=\$API_URL"
