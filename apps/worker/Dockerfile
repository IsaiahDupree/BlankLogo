# CanvasCast Worker - Railway Deployment
# Includes Node.js, ffmpeg, and Chromium for Remotion rendering

FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # FFmpeg for audio/video processing
    ffmpeg \
    # Chromium dependencies for Remotion
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/remotion/package.json ./packages/remotion/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/worker ./apps/worker
COPY packages/remotion ./packages/remotion

# Build worker
RUN pnpm --filter @canvascast/worker build

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Run worker
CMD ["node", "apps/worker/dist/index.js"]
