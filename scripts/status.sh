#!/bin/bash
# ROMulus - Status Check

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
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
echo "║                   📊 ROMulus Status                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "${PROJECT_DIR}"

# Container Status
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🐳 Container Status${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
$COMPOSE_CMD ps
echo ""

# Health Checks
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🏥 Health Checks${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_service() {
    local name=$1
    local url=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name - ${GREEN}Healthy${NC}"
        return 0
    else
        echo -e "  ${RED}✗${NC} $name - ${RED}Unhealthy${NC}"
        return 1
    fi
}

check_service "Web Interface" "http://localhost/health"
check_service "Backend API" "http://localhost/api/health"

echo ""

# Resource Usage
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  💻 Resource Usage${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null | grep romulus || echo "  No containers running"

echo ""

# Disk Usage
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  💾 Data Usage${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -d "${PROJECT_DIR}/data" ]; then
    echo -e "  ${YELLOW}ROMs:${NC}        $(du -sh "${PROJECT_DIR}/data/roms" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}BIOS:${NC}        $(du -sh "${PROJECT_DIR}/data/bios" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}Saves:${NC}       $(du -sh "${PROJECT_DIR}/data/saves" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}States:${NC}      $(du -sh "${PROJECT_DIR}/data/states" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}Covers:${NC}      $(du -sh "${PROJECT_DIR}/data/covers" 2>/dev/null | cut -f1 || echo "0")"
    echo -e "  ${YELLOW}Screenshots:${NC} $(du -sh "${PROJECT_DIR}/data/screenshots" 2>/dev/null | cut -f1 || echo "0")"
fi

echo ""

# ROM Counts
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🎮 ROM Library${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

count_roms() {
    local dir=$1
    local name=$2
    local count=$(find "${PROJECT_DIR}/data/roms/${dir}" -type f 2>/dev/null | wc -l)
    if [ "$count" -gt 0 ]; then
        printf "  ${YELLOW}%-12s${NC} %d files\n" "$name:" "$count"
    fi
}

count_roms "nes" "NES"
count_roms "snes" "SNES"
count_roms "n64" "N64"
count_roms "gb" "GameBoy"
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

echo ""

# Docker Info
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🔧 Docker Volumes${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

docker volume ls --filter name=romulus 2>/dev/null || echo "  No volumes found"

echo ""

# Network Info
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🌐 Access URLs${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo -e "  ${GREEN}Local:${NC}   http://localhost"
echo -e "  ${GREEN}Network:${NC} http://${SERVER_IP}"
echo ""
