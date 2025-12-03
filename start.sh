#!/bin/bash
# ===========================================
#  ROMulus - Start Script
#  👑 Web-Based Multi-Emulation Platform
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
INSTALL_DIR="${ROMULUS_DIR:-/opt/romulus}"
DATA_DIR="${ROMULUS_DATA:-/opt/romulus/data}"
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
    echo -e "        👑 Web-Based Emulator 👑${NC}"
    echo ""
}

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        echo -e "${YELLOW}⚠ Running as root. Consider using a non-root user.${NC}"
    fi
}

# Check Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon not running. Start with: sudo systemctl start docker${NC}"
        exit 1
    fi
}

# Check if already running
check_status() {
    if docker compose -f "$INSTALL_DIR/docker-compose.yml" ps --status running 2>/dev/null | grep -q "romulus"; then
        return 0  # Running
    fi
    return 1  # Not running
}

# Start services
start_services() {
    echo -e "${YELLOW}Starting ROMulus services...${NC}"
    echo ""
    
    cd "$INSTALL_DIR"
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    
    # Pull latest images (optional, comment out for offline)
    # echo -e "${CYAN}Pulling latest images...${NC}"
    # docker compose pull
    
    # Start containers
    echo -e "${CYAN}Starting containers...${NC}"
    docker compose up -d
    
    echo ""
    echo -e "${YELLOW}Waiting for services to be ready...${NC}"
    
    # Wait for health checks
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    echo ""
    
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${YELLOW}⚠ Services taking longer than expected to start.${NC}"
        echo -e "${YELLOW}  Check logs with: ./logs.sh${NC}"
    fi
}

# Show status
show_status() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ROMulus Started Successfully!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo ""
    
    # Get IP addresses
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    echo -e "${CYAN}🌐 Access URLs:${NC}"
    echo -e "   Local:   ${GREEN}http://localhost${NC}"
    echo -e "   Network: ${GREEN}http://${LOCAL_IP}${NC}"
    echo ""
    
    echo -e "${CYAN}📊 Service Status:${NC}"
    docker compose -f "$INSTALL_DIR/docker-compose.yml" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
    docker compose -f "$INSTALL_DIR/docker-compose.yml" ps
    echo ""
    
    echo -e "${CYAN}🔑 Default Credentials:${NC}"
    echo -e "   Email:    ${YELLOW}admin@romulus.local${NC}"
    echo -e "   Password: ${YELLOW}admin123${NC}"
    echo ""
    
    echo -e "${CYAN}📁 Data Directories:${NC}"
    echo -e "   ROMs:     ${YELLOW}${DATA_DIR}/roms/${NC}"
    echo -e "   BIOS:     ${YELLOW}${DATA_DIR}/bios/${NC}"
    echo -e "   Saves:    ${YELLOW}${DATA_DIR}/saves/${NC}"
    echo ""
    
    echo -e "${CYAN}🛠 Useful Commands:${NC}"
    echo -e "   Stop:     ${YELLOW}./stop.sh${NC}"
    echo -e "   Restart:  ${YELLOW}./restart.sh${NC}"
    echo -e "   Logs:     ${YELLOW}./logs.sh${NC}"
    echo -e "   Status:   ${YELLOW}./status.sh${NC}"
    echo ""
}

# Main
main() {
    show_banner
    check_root
    check_docker
    
    # Check if already running
    if check_status; then
        echo -e "${GREEN}✅ ROMulus is already running!${NC}"
        echo ""
        show_status
        exit 0
    fi
    
    start_services
    show_status
    
    # Log startup
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ROMulus started" >> "$LOG_DIR/startup.log"
}

# Handle arguments
case "${1:-}" in
    -h|--help)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  -h, --help     Show this help message"
        echo "  -f, --force    Force restart even if running"
        echo "  -q, --quiet    Quiet mode (less output)"
        echo ""
        exit 0
        ;;
    -f|--force)
        echo -e "${YELLOW}Force restarting...${NC}"
        cd "$INSTALL_DIR"
        docker compose down 2>/dev/null || true
        main
        ;;
    -q|--quiet)
        cd "$INSTALL_DIR"
        docker compose up -d
        echo "ROMulus started"
        ;;
    *)
        main
        ;;
esac
