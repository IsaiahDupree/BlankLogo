#!/bin/bash
# BlankLogo Development Setup Script
# This script checks dependencies and starts all services

set -e

echo "🚀 BlankLogo Development Setup"
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if command exists
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

# Check environment file exists
check_env() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        return 0
    else
        echo -e "${YELLOW}!${NC} $1 not found - copying from example"
        if [ -f "$1.example" ]; then
            cp "$1.example" "$1"
            echo -e "${GREEN}✓${NC} Created $1 from example"
        else
            echo -e "${RED}✗${NC} No example file found for $1"
            return 1
        fi
    fi
}

echo ""
echo "📋 Checking prerequisites..."
echo "----------------------------"

# Check required commands
check_command node
check_command pnpm
check_command redis-cli || echo -e "${YELLOW}  Warning: Redis CLI not found, Redis may not be running locally${NC}"

echo ""
echo "📁 Checking environment files..."
echo "--------------------------------"

# Check env files
check_env "apps/api/.env"
check_env "apps/worker/.env"
check_env "apps/web/.env.local" || check_env "apps/web/.env"

echo ""
echo "📦 Installing dependencies..."
echo "-----------------------------"
pnpm install

echo ""
echo "🗄️  Database Migrations..."
echo "--------------------------"
echo "To apply migrations, run:"
echo "  npx supabase db push"
echo "Or for local Supabase:"
echo "  npx supabase start"
echo "  npx supabase db reset"

echo ""
echo "🔧 Starting services..."
echo "-----------------------"

# Check if Redis is running
if redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✓${NC} Redis is running"
else
    echo -e "${YELLOW}!${NC} Redis not running. Starting with Docker..."
    if command -v docker &> /dev/null; then
        docker run -d --name blanklogo-redis -p 6379:6379 redis:alpine 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Redis container started"
    else
        echo -e "${RED}✗${NC} Docker not available. Please start Redis manually."
    fi
fi

echo ""
echo "🎯 Ready to start development servers!"
echo "======================================="
echo ""
echo "Run each in a separate terminal:"
echo ""
echo "  1. API Server:    cd apps/api && pnpm dev"
echo "  2. Worker:        cd apps/worker && pnpm dev"  
echo "  3. Web App:       cd apps/web && pnpm dev"
echo ""
echo "Or run all at once:"
echo "  pnpm dev"
echo ""
echo "📊 Services will be available at:"
echo "  - Web:    http://localhost:3939"
echo "  - API:    http://localhost:8989"
echo "  - Health: http://localhost:8989/health"
echo ""
