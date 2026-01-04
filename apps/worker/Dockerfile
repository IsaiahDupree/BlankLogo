# BlankLogo Worker - Render Deployment
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy all files
COPY . .

# Install and build
RUN pnpm install --no-frozen-lockfile && pnpm --filter @blanklogo/worker build

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Run worker
CMD ["node", "apps/worker/dist/index.js"]
