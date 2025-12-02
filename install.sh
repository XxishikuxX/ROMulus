#!/bin/bash
# ===========================================
# ROMulus Quick Installer
# ===========================================
# Usage: curl -fsSL https://raw.githubusercontent.com/XxishikuxX/ROMulus/main/install.sh | bash
# Or: wget -qO- https://raw.githubusercontent.com/XxishikuxX/ROMulus/main/install.sh | bash
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/XxishikuxX/ROMulus.git"
INSTALL_DIR="/opt/romulus"
DATA_DIR="/opt/romulus/data"

# Print banner
echo -e "${CYAN}"
cat << "EOF"
    ____  ____  __  ___      __           
   / __ \/ __ \/  |/  /_  __/ /_  _______
  / /_/ / / / / /|_/ / / / / / / / / ___/
 / _, _/ /_/ / /  / / /_/ / / /_/ (__  ) 
/_/ |_|\____/_/  /_/\__,_/_/\__,_/____/  
                                          
EOF
echo -e "${PURPLE}        👑 Web-Based Emulator 👑${NC}"
echo ""
echo -e "${GREEN}ROMulus Installer v2.2${NC}"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Note: Some operations may require sudo privileges.${NC}"
fi

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        echo -e "${RED}Error: Cannot detect OS. This installer supports Ubuntu/Debian.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Detected OS: $OS $VER"
}

# Check system requirements
check_requirements() {
    echo ""
    echo "Checking system requirements..."
    
    # Check RAM
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_RAM" -lt 4 ]; then
        echo -e "${YELLOW}⚠ Warning: Less than 4GB RAM detected. 8GB+ recommended.${NC}"
    else
        echo -e "${GREEN}✓${NC} RAM: ${TOTAL_RAM}GB"
    fi
    
    # Check disk space
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 20 ]; then
        echo -e "${RED}Error: Less than 20GB disk space available.${NC}"
        exit 1
    else
        echo -e "${GREEN}✓${NC} Disk Space: ${AVAILABLE_SPACE}GB available"
    fi
    
    # Check CPU cores
    CPU_CORES=$(nproc)
    if [ "$CPU_CORES" -lt 2 ]; then
        echo -e "${YELLOW}⚠ Warning: Less than 2 CPU cores. 4+ recommended.${NC}"
    else
        echo -e "${GREEN}✓${NC} CPU Cores: $CPU_CORES"
    fi
}

# Install Docker
install_docker() {
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker already installed"
        return
    fi
    
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓${NC} Docker installed"
}

# Install Docker Compose
install_docker_compose() {
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker Compose already installed"
        return
    fi
    
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓${NC} Docker Compose installed"
}

# Clone repository
clone_repo() {
    echo ""
    echo "Cloning ROMulus repository..."
    
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Directory $INSTALL_DIR already exists.${NC}"
        read -p "Do you want to update it? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd "$INSTALL_DIR"
            git pull
        fi
    else
        sudo mkdir -p "$INSTALL_DIR"
        sudo chown $USER:$USER "$INSTALL_DIR"
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi
    
    echo -e "${GREEN}✓${NC} Repository cloned to $INSTALL_DIR"
}

# Create data directories
create_directories() {
    echo ""
    echo "Creating data directories..."
    
    sudo mkdir -p "$DATA_DIR"/{roms,bios,saves,states,covers,screenshots}
    sudo mkdir -p "$DATA_DIR"/roms/{nes,snes,n64,gb,gbc,gba,nds,3ds,gamecube,wii,wiiu,ps1,ps2,ps3,psp,psvita,genesis,saturn,dreamcast,mastersystem,gamegear,segacd,32x,arcade,xbox,xbox360}
    sudo mkdir -p "$DATA_DIR"/bios/{ps1,ps2,saturn,segacd,nds,3ds}
    sudo mkdir -p /opt/romulus/logs
    
    sudo chown -R $USER:$USER "$DATA_DIR"
    sudo chown -R $USER:$USER /opt/romulus/logs
    
    echo -e "${GREEN}✓${NC} Data directories created"
}

# Configure environment
configure_env() {
    echo ""
    echo "Configuring environment..."
    
    cd "$INSTALL_DIR"
    
    if [ ! -f .env ]; then
        cp .env.example .env
        
        # Generate secure JWT secret
        JWT_SECRET=$(openssl rand -hex 32)
        sed -i "s/CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_AT_LEAST_32_CHARS/$JWT_SECRET/" .env
        
        # Generate database password
        DB_PASSWORD=$(openssl rand -hex 16)
        sed -i "s/your_secure_password/$DB_PASSWORD/" .env
        
        echo -e "${GREEN}✓${NC} Environment configured with secure secrets"
    else
        echo -e "${YELLOW}⚠ .env file already exists, skipping configuration${NC}"
    fi
}

# Start services
start_services() {
    echo ""
    echo "Starting ROMulus services..."
    
    cd "$INSTALL_DIR"
    
    # Use docker compose (v2) or docker-compose (v1)
    if docker compose version &> /dev/null; then
        docker compose up -d
    else
        docker-compose up -d
    fi
    
    echo -e "${GREEN}✓${NC} Services started"
}

# Wait for services to be ready
wait_for_services() {
    echo ""
    echo "Waiting for services to be ready..."
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Backend is ready"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "${YELLOW}⚠ Services may still be starting. Check logs with: docker-compose logs -f${NC}"
    fi
}

# Print success message
print_success() {
    echo ""
    echo -e "${CYAN}========================================"
    echo "  ROMulus Installation Complete! 👑"
    echo "========================================${NC}"
    echo ""
    echo "Access ROMulus at:"
    echo -e "  ${CYAN}http://localhost${NC}"
    echo ""
    echo "Default admin credentials:"
    echo -e "  Email:    ${CYAN}admin@romulus.local${NC}"
    echo -e "  Password: ${CYAN}admin123${NC}"
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT: Change the default password after first login!${NC}"
    echo ""
    echo "Data directories:"
    echo "  ROMs:  $DATA_DIR/roms/"
    echo "  BIOS:  $DATA_DIR/bios/"
    echo "  Saves: $DATA_DIR/saves/"
    echo ""
    echo "Useful commands:"
    echo "  View logs:     cd $INSTALL_DIR && docker-compose logs -f"
    echo "  Stop:          cd $INSTALL_DIR && docker-compose down"
    echo "  Restart:       cd $INSTALL_DIR && docker-compose restart"
    echo "  Update:        cd $INSTALL_DIR && git pull && docker-compose up -d --build"
    echo ""
    echo "Documentation: https://github.com/XxishikuxX/ROMulus#readme"
    echo ""
}

# Main installation flow
main() {
    detect_os
    check_requirements
    
    echo ""
    read -p "Continue with installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    install_docker
    install_docker_compose
    clone_repo
    create_directories
    configure_env
    start_services
    wait_for_services
    print_success
}

# Run main function
main
