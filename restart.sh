#!/bin/bash
# ===========================================
#  ROMulus - Restart Script
#  👑 Web-Based Multi-Emulation Platform
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
INSTALL_DIR="${ROMULUS_DIR:-/opt/romulus}"

echo -e "${CYAN}"
echo "    ____  ____  __  ___      __           "
echo "   / __ \/ __ \/  |/  /_  __/ /_  _______"
echo "  / /_/ / / / / /|_/ / / / / / / / / ___/"
echo " / _, _/ /_/ / /  / / /_/ / / /_/ (__  ) "
echo "/_/ |_|\____/_/  /_/\__,_/_/\__,_/____/  "
echo ""
echo -e "       👑 Restarting Services 👑${NC}"
echo ""

cd "$INSTALL_DIR"

# Handle arguments
case "${1:-}" in
    -h|--help)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  -h, --help     Show this help message"
        echo "  -f, --force    Force restart (kill then start)"
        echo "  -q, --quiet    Quiet mode"
        echo "  --pull         Pull latest images before restart"
        echo ""
        exit 0
        ;;
    -f|--force)
        echo -e "${YELLOW}Force restarting...${NC}"
        ./stop.sh -f
        ./start.sh
        ;;
    --pull)
        echo -e "${YELLOW}Pulling latest images...${NC}"
        docker compose pull
        echo ""
        docker compose down
        ./start.sh
        ;;
    -q|--quiet)
        docker compose restart
        echo "ROMulus restarted"
        ;;
    *)
        echo -e "${YELLOW}Stopping services...${NC}"
        docker compose down
        echo ""
        echo -e "${YELLOW}Starting services...${NC}"
        ./start.sh
        ;;
esac
