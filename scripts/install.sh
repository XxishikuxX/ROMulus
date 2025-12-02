#!/bin/bash

# ROMulus Installation Script for Ubuntu Server 24.04 LTS
# This script installs all required dependencies and sets up the platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/romulus"
DATA_DIR="${INSTALL_DIR}/data"
CONFIG_DIR="${INSTALL_DIR}/config"
LOG_DIR="${INSTALL_DIR}/logs"
TMP_DIR="${INSTALL_DIR}/tmp"

# Print banner
print_banner() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║     ███████╗███╗   ███╗██╗   ██╗██╗   ██╗███████╗██████╗    ║"
    echo "║     ██╔════╝████╗ ████║██║   ██║██║   ██║██╔════╝██╔══██╗   ║"
    echo "║     █████╗  ██╔████╔██║██║   ██║██║   ██║█████╗  ██████╔╝   ║"
    echo "║     ██╔══╝  ██║╚██╔╝██║██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗   ║"
    echo "║     ███████╗██║ ╚═╝ ██║╚██████╔╝ ╚████╔╝ ███████╗██║  ██║   ║"
    echo "║     ╚══════╝╚═╝     ╚═╝ ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝   ║"
    echo "║                                                              ║"
    echo "║              Multi-Emulation Platform Installer              ║"
    echo "║                    Ubuntu Server 24.04 LTS                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Logging functions
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

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check Ubuntu version
check_ubuntu_version() {
    log_info "Checking Ubuntu version..."
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        if [[ "$ID" != "ubuntu" ]]; then
            log_error "This script is designed for Ubuntu. Detected: $ID"
            exit 1
        fi
        if [[ "$VERSION_ID" != "24.04" ]]; then
            log_warning "This script is optimized for Ubuntu 24.04. Detected: $VERSION_ID"
            read -p "Continue anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        log_error "Cannot determine OS version"
        exit 1
    fi
    log_success "Ubuntu version check passed"
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    apt-get update
    apt-get upgrade -y
    log_success "System packages updated"
}

# Install base dependencies
install_base_deps() {
    log_info "Installing base dependencies..."
    apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        cmake \
        pkg-config \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        unzip \
        p7zip-full \
        libssl-dev \
        libffi-dev \
        python3 \
        python3-pip \
        python3-venv \
        ffmpeg \
        libavcodec-dev \
        libavformat-dev \
        libavutil-dev \
        libswscale-dev \
        libpulse-dev \
        libasound2-dev \
        libgl1-mesa-dev \
        libglu1-mesa-dev \
        libegl1-mesa-dev \
        libgles2-mesa-dev \
        libdrm-dev \
        libgbm-dev \
        libsdl2-dev \
        libsdl2-ttf-dev \
        libsdl2-image-dev \
        libgtk-3-dev \
        libevdev-dev \
        libudev-dev \
        libusb-1.0-0-dev \
        libhidapi-dev \
        zlib1g-dev \
        libpng-dev \
        libjpeg-dev \
        libfreetype6-dev \
        libfontconfig1-dev \
        libx11-dev \
        libxext-dev \
        libxrandr-dev \
        libxi-dev \
        libxcursor-dev \
        libxinerama-dev \
        libxxf86vm-dev \
        xvfb \
        x11vnc \
        supervisor \
        nginx \
        postgresql \
        postgresql-contrib \
        redis-server
    log_success "Base dependencies installed"
}

# Install Node.js
install_nodejs() {
    log_info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    npm install -g npm@latest
    npm install -g pm2
    log_success "Node.js $(node --version) installed"
}

# Install emulator dependencies
install_emulator_deps() {
    log_info "Installing emulator-specific dependencies..."
    
    # Add PPAs for emulators
    add-apt-repository -y ppa:graphics-drivers/ppa
    
    # Vulkan support
    apt-get install -y \
        vulkan-tools \
        libvulkan-dev \
        libvulkan1 \
        mesa-vulkan-drivers \
        vulkan-validationlayers
    
    # Additional libraries for specific emulators
    apt-get install -y \
        libboost-all-dev \
        libfmt-dev \
        libspeexdsp-dev \
        libminiupnpc-dev \
        libmbedtls-dev \
        libcurl4-openssl-dev \
        libenet-dev \
        libpugixml-dev \
        libzip-dev \
        liblz4-dev \
        libzstd-dev \
        libsamplerate0-dev \
        libsndfile1-dev \
        libbluetooth-dev \
        qtbase5-dev \
        qttools5-dev \
        qtmultimedia5-dev \
        libqt5opengl5-dev \
        libqt5svg5-dev
    
    log_success "Emulator dependencies installed"
}

# Create directory structure
create_directories() {
    log_info "Creating directory structure..."
    
    # Main directories
    mkdir -p "${INSTALL_DIR}"/{app,data,config,logs,tmp}
    mkdir -p "${INSTALL_DIR}/app"/{backend,frontend,streaming}
    
    # ROM directories (central library)
    ROM_SYSTEMS=(
        "ps3" "ps2" "ps1" "psp" "vita"
        "xbox" "xbox360"
        "wiiu" "wii" "gamecube" "3ds" "nds" "n64" "snes" "nes"
        "gba" "gbc" "gb"
        "genesis" "saturn" "dreamcast" "segacd" "32x" "mastersystem" "gamegear"
    )
    
    for system in "${ROM_SYSTEMS[@]}"; do
        mkdir -p "${DATA_DIR}/roms/library/${system}"
    done
    
    # User ROM directory (will be populated per-user)
    mkdir -p "${DATA_DIR}/roms/users"
    
    # BIOS directories
    BIOS_SYSTEMS=("ps3" "ps2" "ps1" "xbox" "saturn" "dreamcast" "3ds" "nds")
    for system in "${BIOS_SYSTEMS[@]}"; do
        mkdir -p "${DATA_DIR}/bios/${system}"
    done
    
    # Other data directories
    mkdir -p "${DATA_DIR}"/{saves,screenshots,covers,database}
    
    # Config directories
    mkdir -p "${CONFIG_DIR}"/{emulators,nginx}
    
    # Set permissions
    chown -R www-data:www-data "${INSTALL_DIR}"
    chmod -R 755 "${INSTALL_DIR}"
    chmod -R 770 "${DATA_DIR}"
    
    log_success "Directory structure created"
}

# Install and configure emulators
install_emulators() {
    log_info "Installing emulator cores..."
    
    EMULATOR_DIR="${INSTALL_DIR}/emulators"
    mkdir -p "${EMULATOR_DIR}"
    
    # RetroArch for cores
    log_info "Installing RetroArch..."
    add-apt-repository -y ppa:libretro/stable
    apt-get update
    apt-get install -y retroarch libretro-*
    
    # PCSX2 (PS2)
    log_info "Installing PCSX2..."
    add-apt-repository -y ppa:pcsx2-team/pcsx2-daily
    apt-get update
    apt-get install -y pcsx2 || log_warning "PCSX2 installation may require manual setup"
    
    # DuckStation (PS1) - AppImage
    log_info "Installing DuckStation..."
    mkdir -p "${EMULATOR_DIR}/duckstation"
    wget -q -O "${EMULATOR_DIR}/duckstation/DuckStation.AppImage" \
        "https://github.com/stenzek/duckstation/releases/download/latest/DuckStation-x64.AppImage" || \
        log_warning "DuckStation download failed - manual installation required"
    chmod +x "${EMULATOR_DIR}/duckstation/DuckStation.AppImage" 2>/dev/null || true
    
    # PPSSPP (PSP)
    log_info "Installing PPSSPP..."
    apt-get install -y ppsspp || {
        add-apt-repository -y ppa:ppsspp/stable
        apt-get update
        apt-get install -y ppsspp
    }
    
    # Dolphin (Wii/GameCube)
    log_info "Installing Dolphin..."
    add-apt-repository -y ppa:dolphin-emu/ppa
    apt-get update
    apt-get install -y dolphin-emu
    
    # Cemu (Wii U) - Manual installation required
    log_info "Cemu requires manual installation..."
    mkdir -p "${EMULATOR_DIR}/cemu"
    
    # Citra (3DS)
    log_info "Installing Citra..."
    mkdir -p "${EMULATOR_DIR}/citra"
    # Note: Citra requires manual setup due to licensing
    
    # melonDS (NDS)
    log_info "Installing melonDS..."
    apt-get install -y melonds || {
        mkdir -p "${EMULATOR_DIR}/melonds"
        log_warning "melonDS may require manual installation"
    }
    
    # mGBA (GBA/GBC/GB)
    log_info "Installing mGBA..."
    apt-get install -y mgba-qt
    
    # Mupen64Plus (N64)
    log_info "Installing Mupen64Plus..."
    apt-get install -y mupen64plus-qt
    
    # RPCS3 (PS3) - AppImage
    log_info "Installing RPCS3..."
    mkdir -p "${EMULATOR_DIR}/rpcs3"
    wget -q -O "${EMULATOR_DIR}/rpcs3/rpcs3.AppImage" \
        "https://rpcs3.net/latest-appimage" || \
        log_warning "RPCS3 download failed - manual installation required"
    chmod +x "${EMULATOR_DIR}/rpcs3/rpcs3.AppImage" 2>/dev/null || true
    
    # xemu (Xbox) - AppImage
    log_info "Installing xemu..."
    mkdir -p "${EMULATOR_DIR}/xemu"
    apt-get install -y xemu || {
        wget -q -O "${EMULATOR_DIR}/xemu/xemu.AppImage" \
            "https://github.com/xemu-project/xemu/releases/latest/download/xemu-v0.7.121-x86_64.AppImage" || \
            log_warning "xemu download failed - manual installation required"
        chmod +x "${EMULATOR_DIR}/xemu/xemu.AppImage" 2>/dev/null || true
    }
    
    # Xenia (Xbox 360) - Windows only, requires Wine/Proton
    log_info "Xenia requires Wine/Proton setup..."
    apt-get install -y wine64 winetricks
    mkdir -p "${EMULATOR_DIR}/xenia"
    
    # Flycast (Dreamcast)
    log_info "Installing Flycast..."
    mkdir -p "${EMULATOR_DIR}/flycast"
    # Usually available through RetroArch
    
    # Vita3K (PS Vita)
    log_info "Installing Vita3K..."
    mkdir -p "${EMULATOR_DIR}/vita3k"
    # Requires manual setup
    
    log_success "Emulator cores installed (some may require manual configuration)"
}

# Setup PostgreSQL database
setup_database() {
    log_info "Setting up PostgreSQL database..."
    
    # Start PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Generate a random password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    
    # Create database and user
    sudo -u postgres psql -c "CREATE USER romulus WITH PASSWORD '${DB_PASSWORD}';" || true
    sudo -u postgres psql -c "CREATE DATABASE romulus OWNER romulus;" || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE romulus TO romulus;" || true
    
    # Save credentials
    echo "DATABASE_URL=postgresql://romulus:${DB_PASSWORD}@localhost:5432/romulus" > "${CONFIG_DIR}/database.env"
    chmod 600 "${CONFIG_DIR}/database.env"
    
    log_success "PostgreSQL database configured"
}

# Setup Redis
setup_redis() {
    log_info "Setting up Redis..."
    systemctl start redis-server
    systemctl enable redis-server
    log_success "Redis configured"
}

# Configure Nginx
configure_nginx() {
    log_info "Configuring Nginx..."
    
    cat > /etc/nginx/sites-available/romulus << 'NGINX_CONF'
upstream romulus_backend {
    server 127.0.0.1:4000;
    keepalive 64;
}

upstream romulus_streaming {
    server 127.0.0.1:8080;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;
    
    client_max_body_size 5G;
    
    # Frontend
    location / {
        root /opt/romulus/app/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API
    location /api {
        proxy_pass http://romulus_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket for real-time features
    location /ws {
        proxy_pass http://romulus_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }
    
    # Game streaming WebRTC
    location /stream {
        proxy_pass http://romulus_streaming;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }
    
    # ROM uploads
    location /upload {
        proxy_pass http://romulus_backend/api/upload;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
    }
    
    # Static files (covers, screenshots)
    location /static {
        alias /opt/romulus/data;
        expires 30d;
        add_header Cache-Control "public";
    }
}
NGINX_CONF
    
    # Enable the site
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/romulus /etc/nginx/sites-enabled/
    
    # Test and reload
    nginx -t
    systemctl reload nginx
    systemctl enable nginx
    
    log_success "Nginx configured"
}

# Create systemd services
create_services() {
    log_info "Creating systemd services..."
    
    # Backend service
    cat > /etc/systemd/system/romulus-backend.service << 'SERVICE'
[Unit]
Description=ROMulus Backend API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/romulus/app/backend
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/opt/romulus/logs/backend.log
StandardError=append:/opt/romulus/logs/backend-error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

    # Streaming service
    cat > /etc/systemd/system/romulus-streaming.service << 'SERVICE'
[Unit]
Description=ROMulus Game Streaming Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/romulus/app/streaming
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/opt/romulus/logs/streaming.log
StandardError=append:/opt/romulus/logs/streaming-error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

    # Virtual display service for headless operation
    cat > /etc/systemd/system/romulus-xvfb.service << 'SERVICE'
[Unit]
Description=ROMulus Virtual Framebuffer
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

    systemctl daemon-reload
    
    log_success "Systemd services created"
}

# Generate application configuration
generate_config() {
    log_info "Generating application configuration..."
    
    # Generate secrets
    JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    SESSION_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    
    # Load database URL
    source "${CONFIG_DIR}/database.env"
    
    cat > "${CONFIG_DIR}/app.env" << ENV_FILE
# ROMulus Configuration
# Generated on $(date)

# Environment
NODE_ENV=production

# Server
PORT=4000
HOST=0.0.0.0
STREAMING_PORT=8080

# Database
DATABASE_URL=${DATABASE_URL}

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
BCRYPT_ROUNDS=12

# Admin Setup (change after first login!)
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=changeme123!

# Streaming
STREAMING_QUALITY=1080p
MAX_CONCURRENT_SESSIONS=10
WEBRTC_ICE_SERVERS=stun:stun.l.google.com:19302

# File Storage
UPLOAD_MAX_SIZE=5368709120
ROM_LIBRARY_PATH=/opt/romulus/data/roms/library
USER_ROM_PATH=/opt/romulus/data/roms/users
BIOS_PATH=/opt/romulus/data/bios
SAVES_PATH=/opt/romulus/data/saves
COVERS_PATH=/opt/romulus/data/covers
SCREENSHOTS_PATH=/opt/romulus/data/screenshots

# Emulator Paths
EMULATOR_PATH=/opt/romulus/emulators
RETROARCH_PATH=/usr/bin/retroarch
RETROARCH_CORES=/usr/lib/libretro

# Features
ENABLE_REGISTRATION=true
ENABLE_MULTIPLAYER=true
ENABLE_RECOMMENDATIONS=true
ENABLE_ACHIEVEMENTS=true

# Display
DISPLAY=:99
ENV_FILE

    chmod 600 "${CONFIG_DIR}/app.env"
    
    log_success "Configuration generated"
}

# Print final instructions
print_final_instructions() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           ROMulus Installation Complete!                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo ""
    echo "1. Copy the application files to ${INSTALL_DIR}/app/"
    echo "   - Backend  → ${INSTALL_DIR}/app/backend/"
    echo "   - Frontend → ${INSTALL_DIR}/app/frontend/"
    echo ""
    echo "2. Install Node.js dependencies:"
    echo "   cd ${INSTALL_DIR}/app/backend && npm install"
    echo "   cd ${INSTALL_DIR}/app/frontend && npm install && npm run build"
    echo ""
    echo "3. Run database migrations:"
    echo "   cd ${INSTALL_DIR}/app/backend && npm run migrate"
    echo ""
    echo "4. Add BIOS files to ${DATA_DIR}/bios/"
    echo ""
    echo "5. Start the services:"
    echo "   sudo systemctl start romulus-xvfb"
    echo "   sudo systemctl start romulus-backend"
    echo "   sudo systemctl start romulus-streaming"
    echo ""
    echo "6. Access the platform at: http://$(hostname -I | awk '{print $1}'):80"
    echo ""
    echo -e "${YELLOW}Default Admin Credentials:${NC}"
    echo "   Email:    admin@localhost"
    echo "   Password: changeme123!"
    echo ""
    echo -e "${RED}⚠ IMPORTANT: Change the admin password immediately after first login!${NC}"
    echo ""
    echo "Configuration file: ${CONFIG_DIR}/app.env"
    echo "Logs directory:     ${LOG_DIR}/"
    echo ""
    echo -e "${CYAN}For more information, see the README.md file${NC}"
}

# Source hardware setup
source_hardware_setup() {
    if [[ -f "$(dirname "$0")/hardware_setup.sh" ]]; then
        source "$(dirname "$0")/hardware_setup.sh"
    fi
}

# Main installation flow
main() {
    print_banner
    
    check_root
    check_ubuntu_version
    
    echo ""
    echo -e "${YELLOW}This script will install ROMulus and its dependencies.${NC}"
    echo -e "${YELLOW}Installation requires approximately 10-20GB of disk space.${NC}"
    echo -e "${CYAN}Supported Hardware: Intel/AMD/ARM CPUs, NVIDIA/AMD/Intel GPUs${NC}"
    echo ""
    read -p "Continue with installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    update_system
    install_base_deps
    install_nodejs
    install_emulator_deps
    
    # Hardware detection and driver installation
    log_info "Setting up hardware support..."
    source_hardware_setup
    setup_hardware
    
    create_directories
    install_emulators
    setup_database
    setup_redis
    configure_nginx
    create_services
    generate_config
    
    print_final_instructions
}

# Run main function
main "$@"
