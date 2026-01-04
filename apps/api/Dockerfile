# BlankLogo API - Render Deployment
FROM node:20-slim

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy all files
COPY . .

# Install and build
RUN pnpm install --no-frozen-lockfile && pnpm --filter @blanklogo/api build

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run API
CMD ["node", "apps/api/dist/index.js"]
