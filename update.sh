#!/bin/bash
# ===========================================
#  ROMulus - Update Script
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
BACKUP_DIR="/opt/romulus-backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${CYAN}"
echo "    ____  ____  __  ___      __           "
echo "   / __ \/ __ \/  |/  /_  __/ /_  _______"
echo "  / /_/ / / / / /|_/ / / / / / / / / ___/"
echo " / _, _/ /_/ / /  / / /_/ / / /_/ (__  ) "
echo "/_/ |_|\____/_/  /_/\__,_/_/\__,_/____/  "
echo ""
echo -e "        👑 Update Manager 👑${NC}"
echo ""

cd "$INSTALL_DIR" 2>/dev/null || {
    echo -e "${RED}❌ ROMulus not installed at $INSTALL_DIR${NC}"
    exit 1
}

# Check for updates
check_updates() {
    echo -e "${YELLOW}Checking for updates...${NC}"
    
    git fetch origin main
    
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        echo -e "${GREEN}✅ ROMulus is up to date!${NC}"
        echo ""
        echo "Current version: $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
        exit 0
    else
        echo -e "${YELLOW}⬆ Update available!${NC}"
        echo ""
        echo "Current: $(git rev-parse --short HEAD)"
        echo "Latest:  $(git rev-parse --short origin/main)"
        echo ""
        
        echo -e "${CYAN}Recent changes:${NC}"
        git log --oneline HEAD..origin/main | head -10
        echo ""
    fi
}

# Backup current installation
backup() {
    echo -e "${YELLOW}Creating backup...${NC}"
    
    # Backup config files
    mkdir -p "$BACKUP_DIR"
    cp .env "$BACKUP_DIR/" 2>/dev/null || true
    cp docker-compose.yml "$BACKUP_DIR/" 2>/dev/null || true
    
    # Backup database
    if docker compose ps --status running 2>/dev/null | grep -q "romulus-db"; then
        echo "Backing up database..."
        docker compose exec -T db pg_dump -U romulus romulus > "$BACKUP_DIR/database.sql" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ Backup saved to: $BACKUP_DIR${NC}"
    echo ""
}

# Perform update
update() {
    echo -e "${YELLOW}Stopping services...${NC}"
    docker compose down
    echo ""
    
    echo -e "${YELLOW}Pulling latest changes...${NC}"
    git pull origin main
    echo ""
    
    echo -e "${YELLOW}Pulling latest Docker images...${NC}"
    docker compose pull
    echo ""
    
    echo -e "${YELLOW}Rebuilding containers...${NC}"
    docker compose build --no-cache
    echo ""
    
    echo -e "${YELLOW}Starting services...${NC}"
    docker compose up -d
    echo ""
    
    # Wait for services
    echo -e "${YELLOW}Waiting for services to start...${NC}"
    sleep 10
    
    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker compose exec -T backend npx prisma migrate deploy 2>/dev/null || true
    echo ""
}

# Main
main() {
    case "${1:-}" in
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -h, --help     Show this help"
            echo "  -c, --check    Check for updates only"
            echo "  -f, --force    Force update without confirmation"
            echo "  -y, --yes      Auto-confirm update"
            echo "  --rollback     Rollback to previous version"
            echo ""
            exit 0
            ;;
        -c|--check)
            check_updates
            exit 0
            ;;
        --rollback)
            echo -e "${YELLOW}Rolling back to previous version...${NC}"
            git checkout HEAD~1
            docker compose down
            docker compose up -d
            echo -e "${GREEN}✅ Rollback complete${NC}"
            exit 0
            ;;
        -f|--force|-y|--yes)
            check_updates
            backup
            update
            ;;
        *)
            check_updates
            
            echo -e "${YELLOW}Do you want to update? (y/N)${NC}"
            read -r confirm
            
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                backup
                update
            else
                echo "Update cancelled."
                exit 0
            fi
            ;;
    esac
    
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ROMulus Updated Successfully!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo ""
    echo "New version: $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
    echo ""
    echo -e "Backup saved to: ${YELLOW}$BACKUP_DIR${NC}"
    echo ""
}

main "$@"
