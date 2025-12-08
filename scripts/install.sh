#!/bin/bash
# ===========================================
#  ROMulus - Docker Installation Script
#  👑 Web-Based Multi-Emulation Platform
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Print banner
print_banner() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║     ██████╗  ██████╗ ███╗   ███╗██╗   ██╗██╗     ██╗   ██╗  ║"
    echo "║     ██╔══██╗██╔═══██╗████╗ ████║██║   ██║██║     ██║   ██║  ║"
    echo "║     ██████╔╝██║   ██║██╔████╔██║██║   ██║██║     ██║   ██║  ║"
    echo "║     ██╔══██╗██║   ██║██║╚██╔╝██║██║   ██║██║     ██║   ██║  ║"
    echo "║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║╚██████╔╝███████╗╚██████╔╝  ║"
    echo "║     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝   ║"
    echo "║                                                              ║"
    echo "║              👑 Docker Installation Script                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed!"
        echo ""
        echo "Please install Docker first:"
        echo "  Ubuntu/Debian: curl -fsSL https://get.docker.com | sh"
        echo "  Or visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    log_success "Docker found: $(docker --version)"
}

# Check if Docker Compose is installed
check_docker_compose() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        log_success "Docker Compose found: $(docker compose version --short)"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        log_success "Docker Compose found: $(docker-compose --version)"
    else
        log_error "Docker Compose is not installed!"
        echo ""
        echo "Docker Compose should be included with Docker Desktop."
        echo "For Linux, install with: sudo apt install docker-compose-plugin"
        exit 1
    fi
}

# Create data directories
create_directories() {
    log_info "Creating data directories..."
    
    # ROM directories
    ROM_DIRS=(
        "nes" "snes" "n64" "gamecube" "wii" "wiiu"
        "gb" "gbc" "gba" "nds" "3ds"
        "ps1" "ps2" "ps3" "psp" "psvita"
        "genesis" "saturn" "dreamcast" "mastersystem" "gamegear" "segacd" "sega32x"
        "xbox" "xbox360"
        "arcade" "neogeo" "turbografx16" "atari2600" "atari7800"
    )
    
    for dir in "${ROM_DIRS[@]}"; do
        mkdir -p "${PROJECT_DIR}/data/roms/${dir}"
    done
    
    # BIOS directories
    BIOS_DIRS=(
        "ps1" "ps2" "ps3" "psp" "psvita"
        "saturn" "dreamcast" "segacd"
        "nds" "3ds" "gba"
        "xbox" "xbox360"
    )
    
    for dir in "${BIOS_DIRS[@]}"; do
        mkdir -p "${PROJECT_DIR}/data/bios/${dir}"
    done
    
    # Other directories
    mkdir -p "${PROJECT_DIR}/data/saves"
    mkdir -p "${PROJECT_DIR}/data/states"
    mkdir -p "${PROJECT_DIR}/data/covers"
    mkdir -p "${PROJECT_DIR}/data/screenshots"
    mkdir -p "${PROJECT_DIR}/data/cheats"
    mkdir -p "${PROJECT_DIR}/nginx/ssl"
    
    log_success "Data directories created"
}

# Create .env file
create_env_file() {
    log_info "Creating environment file..."
    
    if [ -f "${PROJECT_DIR}/.env" ]; then
        log_warning ".env file already exists, skipping..."
        return
    fi
    
    # Generate secure passwords
    DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    
    cat > "${PROJECT_DIR}/.env" <<EOF
# ===========================================
#  ROMulus Docker Configuration
# ===========================================

# Database
DB_PASSWORD=${DB_PASSWORD}

# Security
JWT_SECRET=${JWT_SECRET}

# Admin Account (change after first login!)
ADMIN_EMAIL=admin@romulus.local
ADMIN_PASSWORD=admin123

# Ports
HTTP_PORT=80
HTTPS_PORT=443

# Optional: Uncomment for custom settings
# MAX_CONCURRENT_SESSIONS=10
# MAX_FILE_SIZE=4294967296
EOF

    chmod 600 "${PROJECT_DIR}/.env"
    log_success "Environment file created"
}

# Build Docker images
build_images() {
    log_info "Building Docker images (this may take a few minutes)..."
    
    cd "${PROJECT_DIR}"
    $COMPOSE_CMD build --no-cache
    
    log_success "Docker images built"
}

# Start services
start_services() {
    log_info "Starting ROMulus services..."
    
    cd "${PROJECT_DIR}"
    $COMPOSE_CMD up -d
    
    log_success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f http://localhost/health > /dev/null 2>&1; then
            log_success "All services are ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -ne "\r  Waiting... ($attempt/$max_attempts)"
        sleep 2
    done
    
    echo ""
    log_warning "Services may still be starting. Check with: docker compose logs"
}

# Print completion message
print_completion() {
    local SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║          ✅ ROMulus Installation Complete!                   ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}🌐 Access ROMulus:${NC}"
    echo -e "   Local:   ${GREEN}http://localhost${NC}"
    echo -e "   Network: ${GREEN}http://${SERVER_IP}${NC}"
    echo ""
    echo -e "${CYAN}🔑 Default Login:${NC}"
    echo -e "   Email:    ${YELLOW}admin@romulus.local${NC}"
    echo -e "   Password: ${YELLOW}admin123${NC}"
    echo ""
    echo -e "${RED}⚠️  Change the default password immediately!${NC}"
    echo ""
    echo -e "${CYAN}📁 Data Directories:${NC}"
    echo -e "   ROMs:  ${YELLOW}${PROJECT_DIR}/data/roms/${NC}"
    echo -e "   BIOS:  ${YELLOW}${PROJECT_DIR}/data/bios/${NC}"
    echo -e "   Saves: ${YELLOW}${PROJECT_DIR}/data/saves/${NC}"
    echo ""
    echo -e "${CYAN}🛠 Management Commands:${NC}"
    echo -e "   Start:   ${YELLOW}./scripts/start.sh${NC}"
    echo -e "   Stop:    ${YELLOW}./scripts/stop.sh${NC}"
    echo -e "   Status:  ${YELLOW}./scripts/status.sh${NC}"
    echo -e "   Logs:    ${YELLOW}./scripts/logs.sh${NC}"
    echo -e "   Update:  ${YELLOW}./scripts/update.sh${NC}"
    echo ""
}

# Main installation
main() {
    print_banner
    
    log_info "Starting ROMulus Docker installation..."
    echo ""
    
    check_docker
    check_docker_compose
    create_directories
    create_env_file
    build_images
    start_services
    wait_for_services
    
    print_completion
}

main "$@"
