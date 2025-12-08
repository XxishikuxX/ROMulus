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

# Create startup script
RUN cat > /app/start.sh << 'STARTEOF'
#!/bin/sh
set -e

echo "🎮 ROMulus Backend Starting..."

# Wait for database
echo "⏳ Waiting for database..."
sleep 5

# Run migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy || npx prisma db push --accept-data-loss

# Seed admin user if needed
echo "👤 Checking admin user..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@romulus.local';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        username: 'admin',
        password: hash,
        role: 'ADMIN',
        isVerified: true
      }
    });
    console.log('✅ Admin user created:', email);
  } else {
    console.log('✅ Admin user exists:', email);
  }
  await prisma.\$disconnect();
}

seed().catch(e => {
  console.error('Seed error:', e);
  process.exit(1);
});
"

# Start server
echo "🚀 Starting server..."
exec node dist/server.js
STARTEOF

RUN chmod +x /app/start.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S romulus -u 1001
RUN chown -R romulus:nodejs /app

USER romulus

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["/app/start.sh"]
