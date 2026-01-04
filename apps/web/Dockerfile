# BlankLogo Web Frontend - Render Deployment
FROM node:20-slim

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy all files
COPY . .

# Install and build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --no-frozen-lockfile && pnpm --filter @blanklogo/web build

# Set environment
ENV NODE_ENV=production
ENV PORT=3939

EXPOSE 3939

CMD ["sh", "-c", "cd apps/web && npm start"]
