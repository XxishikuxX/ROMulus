#!/bin/bash
# ROMulus - Stop Services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Detect docker compose command
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Parse arguments
REMOVE_VOLUMES=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./stop.sh [options]"
            echo ""
            echo "Options:"
            echo "  -f, --force     Force stop (kill containers)"
            echo "  -v, --volumes   Remove volumes (WARNING: deletes database!)"
            echo "  -h, --help      Show this help"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    🛑 Stopping ROMulus                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "${PROJECT_DIR}"

if [ "$REMOVE_VOLUMES" = true ]; then
    echo -e "${RED}[WARNING]${NC} This will delete all database data!"
    if [ "$FORCE" != true ]; then
        read -p "Are you sure? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo "Cancelled."
            exit 0
        fi
    fi
    echo -e "${BLUE}[INFO]${NC} Stopping and removing volumes..."
    $COMPOSE_CMD down -v
else
    echo -e "${BLUE}[INFO]${NC} Stopping containers..."
    if [ "$FORCE" = true ]; then
        $COMPOSE_CMD kill
    fi
    $COMPOSE_CMD down
fi

echo ""
echo -e "${GREEN}[SUCCESS]${NC} ROMulus stopped!"
echo ""
echo -e "${YELLOW}📁 Data preserved in:${NC}"
echo "   ${PROJECT_DIR}/data/"
echo ""
echo "Run './scripts/start.sh' to start again"
