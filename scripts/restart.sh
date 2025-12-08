#!/bin/bash
# ROMulus - Restart Services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Detect docker compose command
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Parse arguments
SERVICE=""
REBUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--rebuild)
            REBUILD=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./restart.sh [options] [service]"
            echo ""
            echo "Options:"
            echo "  -b, --rebuild   Rebuild images before starting"
            echo "  -h, --help      Show this help"
            echo ""
            echo "Services: backend, frontend, streaming, postgres, redis"
            exit 0
            ;;
        *)
            SERVICE=$1
            shift
            ;;
    esac
done

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   🔄 Restarting ROMulus                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "${PROJECT_DIR}"

if [ "$REBUILD" = true ]; then
    echo -e "${BLUE}[INFO]${NC} Rebuilding images..."
    if [ -n "$SERVICE" ]; then
        $COMPOSE_CMD build --no-cache $SERVICE
    else
        $COMPOSE_CMD build --no-cache
    fi
fi

if [ -n "$SERVICE" ]; then
    echo -e "${BLUE}[INFO]${NC} Restarting $SERVICE..."
    $COMPOSE_CMD restart $SERVICE
else
    echo -e "${BLUE}[INFO]${NC} Restarting all services..."
    $COMPOSE_CMD restart
fi

echo ""
echo -e "${GREEN}[SUCCESS]${NC} Restart complete!"
echo ""

$COMPOSE_CMD ps
