# Standalone test for @sparticuz/chromium on Linux
FROM node:20-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    wget ca-certificates fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libxcomposite1 libxdamage1 libxfixes3 \
    libxkbcommon0 libxrandr2 xdg-utils curl \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create package.json with stealth plugin
RUN echo '{"type":"module","dependencies":{"@sparticuz/chromium":"^143.0.4","puppeteer-core":"^24.0.0","puppeteer-extra":"^3.3.6","puppeteer-extra-plugin-stealth":"^2.11.2"}}' > package.json

# Install dependencies
RUN npm install

# Copy test script
COPY test.ts .

# Set Railway environment
ENV RAILWAY_ENVIRONMENT=production

CMD ["npx", "tsx", "test.ts"]
