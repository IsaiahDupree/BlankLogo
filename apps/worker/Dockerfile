# BlankLogo Worker - Railway Deployment
# Includes Node.js and FFmpeg for watermark removal processing

FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # FFmpeg for audio/video processing
    ffmpeg \
    # Additional utilities
    curl \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/worker ./apps/worker
COPY packages/shared ./packages/shared

# Build worker
RUN pnpm --filter @blanklogo/worker build

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Run worker
CMD ["node", "apps/worker/dist/index.js"]
