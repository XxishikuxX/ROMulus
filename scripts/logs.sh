#!/bin/bash
# ROMulus - View Logs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Detect docker compose command
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Default values
SERVICE=""
FOLLOW=false
LINES=100
SINCE=""
ERRORS_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--lines)
            LINES=$2
            shift 2
            ;;
        --since)
            SINCE=$2
            shift 2
            ;;
        --errors)
            ERRORS_ONLY=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./logs.sh [options] [service]"
            echo ""
            echo "Services: backend, frontend, streaming, postgres, redis, all"
            echo ""
            echo "Options:"
            echo "  -f, --follow    Follow log output"
            echo "  -n, --lines N   Number of lines to show (default: 100)"
            echo "  --since TIME    Show logs since timestamp (e.g., 1h, 30m)"
            echo "  --errors        Show only errors"
            echo "  -h, --help      Show this help"
            echo ""
            echo "Examples:"
            echo "  ./logs.sh backend -f        # Follow backend logs"
            echo "  ./logs.sh --since 1h        # Logs from last hour"
            echo "  ./logs.sh backend --errors  # Only backend errors"
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
echo "║                    📋 ROMulus Logs                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "${PROJECT_DIR}"

# Build command
CMD="$COMPOSE_CMD logs"

if [ "$FOLLOW" = true ]; then
    CMD="$CMD -f"
fi

CMD="$CMD --tail=$LINES"

if [ -n "$SINCE" ]; then
    CMD="$CMD --since=$SINCE"
fi

if [ -n "$SERVICE" ] && [ "$SERVICE" != "all" ]; then
    CMD="$CMD $SERVICE"
fi

echo -e "${BLUE}[INFO]${NC} Running: $CMD"
echo ""

if [ "$ERRORS_ONLY" = true ]; then
    $CMD 2>&1 | grep -iE "error|exception|fatal|critical|failed" --color=always
else
    $CMD
fi
