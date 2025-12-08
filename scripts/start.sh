#!/bin/bash
# ROMulus - Start Services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Detect docker compose command
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    🎮 Starting ROMulus                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "${PROJECT_DIR}"

# Check if already running
if $COMPOSE_CMD ps --status running 2>/dev/null | grep -q "romulus"; then
    echo -e "${YELLOW}[WARNING]${NC} ROMulus is already running"
    echo ""
    echo "Use './scripts/restart.sh' to restart services"
    echo "Use './scripts/status.sh' to check status"
    exit 0
fi

echo -e "${BLUE}[INFO]${NC} Starting Docker containers..."
$COMPOSE_CMD up -d

echo ""
echo -e "${GREEN}[SUCCESS]${NC} ROMulus started!"
echo ""
echo -e "${BLUE}[INFO]${NC} Checking service status..."
sleep 3

$COMPOSE_CMD ps

echo ""
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo -e "${GREEN}🌐 Access ROMulus at:${NC}"
echo -e "   http://localhost"
echo -e "   http://${SERVER_IP}"
echo ""
echo "Run './scripts/logs.sh' to view logs"
