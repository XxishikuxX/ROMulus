#!/bin/bash
# ===========================================
#  ROMulus - Status Script
#  👑 Web-Based Multi-Emulation Platform
# ===========================================

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

echo -e "${CYAN}"
echo "    ____  ____  __  ___      __           "
echo "   / __ \/ __ \/  |/  /_  __/ /_  _______"
echo "  / /_/ / / / / /|_/ / / / / / / / / ___/"
echo " / _, _/ /_/ / /  / / /_/ / / /_/ (__  ) "
echo "/_/ |_|\____/_/  /_/\__,_/_/\__,_/____/  "
echo ""
echo -e "         👑 System Status 👑${NC}"
echo ""

cd "$INSTALL_DIR" 2>/dev/null || {
    echo -e "${RED}❌ ROMulus not installed at $INSTALL_DIR${NC}"
    exit 1
}

# Check if running
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  📊 Container Status${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if docker compose ps --status running 2>/dev/null | grep -q "romulus"; then
    echo -e "${GREEN}  ● ROMulus is RUNNING${NC}"
    echo ""
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
else
    echo -e "${RED}  ○ ROMulus is STOPPED${NC}"
    echo ""
    echo -e "  Run ${YELLOW}./start.sh${NC} to start"
fi

echo ""

# Health checks
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🏥 Health Checks${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_service() {
    local name=$1
    local url=$2
    
    if curl -s --max-time 2 "$url" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name"
    else
        echo -e "  ${RED}✗${NC} $name"
    fi
}

check_service "Frontend (Nginx)"     "http://localhost"
check_service "Backend API"          "http://localhost:3000/health"
check_service "Streaming Server"     "http://localhost:8080"
check_service "WebSocket"            "http://localhost:3000/socket.io/"

echo ""

# Resource usage
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  💻 Resource Usage${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
    $(docker compose ps -q 2>/dev/null) 2>/dev/null || echo "  Unable to get stats"

echo ""

# Disk usage
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  💾 Disk Usage${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -d "$DATA_DIR" ]; then
    echo -e "  ${YELLOW}ROMs:${NC}        $(du -sh "$DATA_DIR/roms" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}BIOS:${NC}        $(du -sh "$DATA_DIR/bios" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}Saves:${NC}       $(du -sh "$DATA_DIR/saves" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}States:${NC}      $(du -sh "$DATA_DIR/states" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}Covers:${NC}      $(du -sh "$DATA_DIR/covers" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}Screenshots:${NC} $(du -sh "$DATA_DIR/screenshots" 2>/dev/null | cut -f1 || echo "0")"
    echo ""
    echo -e "  ${MAGENTA}Total:${NC}       $(du -sh "$DATA_DIR" 2>/dev/null | cut -f1 || echo "0")"
else
    echo "  Data directory not found"
fi

echo ""

# ROM counts
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🎮 ROM Library${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -d "$DATA_DIR/roms" ]; then
    count_roms() {
        local dir=$1
        local name=$2
        local count=$(find "$DATA_DIR/roms/$dir" -type f 2>/dev/null | wc -l)
        if [ "$count" -gt 0 ]; then
            printf "  %-12s %s ROMs\n" "$name:" "$count"
        fi
    }
    
    count_roms "nes" "NES"
    count_roms "snes" "SNES"
    count_roms "n64" "N64"
    count_roms "gb" "Game Boy"
    count_roms "gbc" "GBC"
    count_roms "gba" "GBA"
    count_roms "nds" "NDS"
    count_roms "gamecube" "GameCube"
    count_roms "wii" "Wii"
    count_roms "ps1" "PS1"
    count_roms "ps2" "PS2"
    count_roms "psp" "PSP"
    count_roms "genesis" "Genesis"
    count_roms "dreamcast" "Dreamcast"
    count_roms "arcade" "Arcade"
    
    total=$(find "$DATA_DIR/roms" -type f 2>/dev/null | wc -l)
    echo ""
    echo -e "  ${MAGENTA}Total: $total ROMs${NC}"
else
    echo "  No ROMs found"
fi

echo ""

# Network info
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🌐 Network${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")
echo -e "  Local URL:   ${GREEN}http://localhost${NC}"
echo -e "  Network URL: ${GREEN}http://${LOCAL_IP}${NC}"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
