FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Build
COPY . .
RUN npm run build
RUN npx prisma generate

# Production image
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Create data directories
RUN mkdir -p /opt/emuverse/data /opt/emuverse/logs && \
    chown -R nodejs:nodejs /opt/emuverse

USER nodejs

EXPOSE 4000

CMD ["node", "dist/server.js"]
