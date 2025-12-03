#!/bin/bash
# ===========================================
#  ROMulus - Logs Viewer
#  👑 Web-Based Multi-Emulation Platform
# ===========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
INSTALL_DIR="${ROMULUS_DIR:-/opt/romulus}"

cd "$INSTALL_DIR" 2>/dev/null || {
    echo -e "${RED}❌ ROMulus not installed at $INSTALL_DIR${NC}"
    exit 1
}

# Help
show_help() {
    echo "Usage: $0 [service] [options]"
    echo ""
    echo "Services:"
    echo "  all        Show all logs (default)"
    echo "  backend    Backend API logs"
    echo "  frontend   Frontend/Nginx logs"
    echo "  db         PostgreSQL database logs"
    echo "  redis      Redis cache logs"
    echo "  streaming  Streaming server logs"
    echo ""
    echo "Options:"
    echo "  -f, --follow    Follow log output (live)"
    echo "  -n, --lines N   Show last N lines (default: 100)"
    echo "  --since TIME    Show logs since TIME (e.g., '1h', '30m', '2023-01-01')"
    echo "  --errors        Show only error logs"
    echo "  -h, --help      Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                    # Show all logs"
    echo "  $0 backend -f         # Follow backend logs"
    echo "  $0 db --since 1h      # DB logs from last hour"
    echo "  $0 --errors           # Show only errors"
}

# Parse arguments
SERVICE="all"
FOLLOW=""
LINES="100"
SINCE=""
ERRORS_ONLY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--follow)
            FOLLOW="-f"
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        --since)
            SINCE="--since $2"
            shift 2
            ;;
        --errors)
            ERRORS_ONLY=true
            shift
            ;;
        all|backend|frontend|db|redis|streaming)
            SERVICE="$1"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Map service names to container names
get_container() {
    case "$1" in
        backend)   echo "romulus-backend" ;;
        frontend)  echo "romulus-frontend" ;;
        db)        echo "romulus-db" ;;
        redis)     echo "romulus-redis" ;;
        streaming) echo "romulus-streaming" ;;
        all)       echo "" ;;
    esac
}

# Show logs
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  📋 ROMulus Logs - ${SERVICE}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$ERRORS_ONLY" = true ]; then
    echo -e "${YELLOW}Filtering for errors only...${NC}"
    echo ""
    
    if [ "$SERVICE" = "all" ]; then
        docker compose logs --tail="$LINES" $SINCE 2>/dev/null | grep -iE "(error|exception|fatal|critical|failed)" || echo "No errors found"
    else
        container=$(get_container "$SERVICE")
        docker compose logs "$container" --tail="$LINES" $SINCE 2>/dev/null | grep -iE "(error|exception|fatal|critical|failed)" || echo "No errors found"
    fi
else
    if [ "$SERVICE" = "all" ]; then
        docker compose logs --tail="$LINES" $FOLLOW $SINCE
    else
        container=$(get_container "$SERVICE")
        docker compose logs "$container" --tail="$LINES" $FOLLOW $SINCE
    fi
fi
