FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache curl

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Create data directories
RUN mkdir -p /data/roms /data/bios /data/saves /data/states /data/covers /data/screenshots /data/cheats

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S romulus -u 1001
RUN chown -R romulus:nodejs /app /data

USER romulus

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start command with migration
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
