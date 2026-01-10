#!/bin/bash
# RunPod Status Check Script
# Usage: ./scripts/runpod-status.sh

set -e

# Load environment
if [ -f .env.runpod ]; then
    source .env.runpod
fi

if [ -z "$RUNPOD_API_KEY" ]; then
    echo "❌ RUNPOD_API_KEY not set"
    echo "Set it in .env.runpod or export RUNPOD_API_KEY=..."
    exit 1
fi

echo "=============================================="
echo "RunPod Status Check"
echo "=============================================="
echo ""

# Get all pods
echo "=== Active Pods ==="
curl -s -H "Authorization: Bearer $RUNPOD_API_KEY" \
  "https://api.runpod.io/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { myself { pods { id name desiredStatus lastStatusChange runtime { uptimeInSeconds ports { ip privatePort publicPort type } gpus { id gpuUtilPercent memoryUtilPercent } } } } }"}' | jq '.data.myself.pods[] | {
    id: .id,
    name: .name,
    status: .desiredStatus,
    uptime_seconds: .runtime.uptimeInSeconds,
    gpu_util: (.runtime.gpus[0].gpuUtilPercent // "N/A"),
    gpu_mem: (.runtime.gpus[0].memoryUtilPercent // "N/A"),
    http_port: (.runtime.ports[] | select(.privatePort == 8081) | "\(.ip):\(.publicPort)"),
    ssh_port: (.runtime.ports[] | select(.privatePort == 22) | "\(.ip):\(.publicPort)")
  }'

echo ""
echo "=== Account Info ==="
curl -s -H "Authorization: Bearer $RUNPOD_API_KEY" \
  "https://api.runpod.io/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { myself { id email currentSpendPerHr creditBalance } }"}' | jq '.data.myself | {
    email: .email,
    spend_per_hour: .currentSpendPerHr,
    credit_balance: .creditBalance
  }'

echo ""
echo "=============================================="
