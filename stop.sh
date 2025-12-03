#!/bin/bash
# ===========================================
#  ROMulus - Stop Script
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
LOG_DIR="${ROMULUS_LOGS:-/opt/romulus/logs}"

# Banner
show_banner() {
    echo -e "${CYAN}"
    echo "    ____  ____  __  ___      __           "
    echo "   / __ \/ __ \/  |/  /_  __/ /_  _______"
    echo "  / /_/ / / / / /|_/ / / / / / / / / ___/"
    echo " / _, _/ /_/ / /  / / /_/ / / /_/ (__  ) "
    echo "/_/ |_|\____/_/  /_/\__,_/_/\__,_/____/  "
    echo ""
    echo -e "        👑 Stopping Services 👑${NC}"
    echo ""
}

# Check if running
check_status() {
    if docker compose -f "$INSTALL_DIR/docker-compose.yml" ps --status running 2>/dev/null | grep -q "romulus"; then
        return 0  # Running
    fi
    return 1  # Not running
}

# Stop services
stop_services() {
    echo -e "${YELLOW}Stopping ROMulus services...${NC}"
    echo ""
    
    cd "$INSTALL_DIR"
    
    # Graceful shutdown
    echo -e "${CYAN}Sending shutdown signal...${NC}"
    docker compose stop
    
    echo ""
    echo -e "${CYAN}Removing containers...${NC}"
    docker compose down
    
    echo ""
}

# Show stopped status
show_stopped() {
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ROMulus Stopped Successfully!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}💾 Your data is preserved in:${NC}"
    echo -e "   ROMs:  ${YELLOW}/opt/romulus/data/roms/${NC}"
    echo -e "   Saves: ${YELLOW}/opt/romulus/data/saves/${NC}"
    echo -e "   BIOS:  ${YELLOW}/opt/romulus/data/bios/${NC}"
    echo ""
    echo -e "${CYAN}🚀 To start again:${NC}"
    echo -e "   ${YELLOW}./start.sh${NC}"
    echo ""
    
    # Log shutdown
    mkdir -p "$LOG_DIR"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ROMulus stopped" >> "$LOG_DIR/startup.log"
}

# Force stop (kill containers)
force_stop() {
    echo -e "${RED}⚠ Force stopping all ROMulus containers...${NC}"
    
    cd "$INSTALL_DIR"
    
    # Kill containers
    docker compose kill 2>/dev/null || true
    docker compose down --remove-orphans 2>/dev/null || true
    
    # Remove any dangling containers
    docker ps -a --filter "name=romulus" -q | xargs -r docker rm -f 2>/dev/null || true
    
    echo -e "${GREEN}✅ Force stop complete${NC}"
}

# Stop and remove volumes (full reset)
stop_and_clean() {
    echo -e "${RED}⚠ WARNING: This will stop ROMulus and remove all Docker volumes!${NC}"
    echo -e "${RED}  Your ROM files in /opt/romulus/data will be preserved.${NC}"
    echo -e "${RED}  Database and Redis data will be DELETED.${NC}"
    echo ""
    read -p "Are you sure? (y/N): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        cd "$INSTALL_DIR"
        docker compose down -v
        echo -e "${GREEN}✅ Stopped and cleaned${NC}"
    else
        echo "Cancelled."
        exit 0
    fi
}

# Main
main() {
    show_banner
    
    # Check if running
    if ! check_status; then
        echo -e "${YELLOW}ℹ ROMulus is not currently running.${NC}"
        echo ""
        exit 0
    fi
    
    stop_services
    show_stopped
}

# Handle arguments
case "${1:-}" in
    -h|--help)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  -h, --help     Show this help message"
        echo "  -f, --force    Force kill containers (use if graceful stop hangs)"
        echo "  -c, --clean    Stop and remove Docker volumes (keeps ROM files)"
        echo "  -q, --quiet    Quiet mode (less output)"
        echo ""
        exit 0
        ;;
    -f|--force)
        show_banner
        force_stop
        ;;
    -c|--clean)
        show_banner
        stop_and_clean
        ;;
    -q|--quiet)
        cd "$INSTALL_DIR"
        docker compose down
        echo "ROMulus stopped"
        ;;
    *)
        main
        ;;
esac
