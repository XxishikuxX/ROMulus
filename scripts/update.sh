#!/bin/bash
# ROMulus - Update Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Detect docker compose command
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Parse arguments
CHECK_ONLY=false
AUTO_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--check)
            CHECK_ONLY=true
            shift
            ;;
        -y|--yes)
            AUTO_CONFIRM=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./update.sh [options]"
            echo ""
            echo "Options:"
            echo "  -c, --check   Check for updates only"
            echo "  -y, --yes     Auto-confirm update"
            echo "  -h, --help    Show this help"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   🔄 ROMulus Update                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "${PROJECT_DIR}"

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Git is not installed"
    exit 1
fi

# Check if this is a git repo
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}[WARNING]${NC} Not a git repository. Manual update required."
    echo ""
    echo "To update manually:"
    echo "  1. Download the latest release"
    echo "  2. Stop services: ./scripts/stop.sh"
    echo "  3. Replace files (keep your data/ and .env)"
    echo "  4. Rebuild: docker compose build"
    echo "  5. Start: ./scripts/start.sh"
    exit 0
fi

# Fetch updates
echo -e "${BLUE}[INFO]${NC} Checking for updates..."
git fetch origin main 2>/dev/null || git fetch origin master 2>/dev/null || {
    echo -e "${RED}[ERROR]${NC} Failed to fetch updates"
    exit 1
}

# Check if updates available
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}[SUCCESS]${NC} Already up to date!"
    exit 0
fi

# Show changes
echo ""
echo -e "${YELLOW}Updates available:${NC}"
git log --oneline HEAD..origin/main 2>/dev/null || git log --oneline HEAD..origin/master 2>/dev/null
echo ""

if [ "$CHECK_ONLY" = true ]; then
    echo "Run './scripts/update.sh' to apply updates"
    exit 0
fi

# Confirm update
if [ "$AUTO_CONFIRM" != true ]; then
    read -p "Apply update? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Update cancelled."
        exit 0
    fi
fi

# Backup .env
echo -e "${BLUE}[INFO]${NC} Backing up configuration..."
cp .env .env.backup 2>/dev/null || true

# Stop services
echo -e "${BLUE}[INFO]${NC} Stopping services..."
$COMPOSE_CMD down

# Pull updates
echo -e "${BLUE}[INFO]${NC} Pulling updates..."
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null

# Restore .env
cp .env.backup .env 2>/dev/null || true

# Rebuild images
echo -e "${BLUE}[INFO]${NC} Rebuilding Docker images..."
$COMPOSE_CMD build --no-cache

# Start services
echo -e "${BLUE}[INFO]${NC} Starting services..."
$COMPOSE_CMD up -d

echo ""
echo -e "${GREEN}[SUCCESS]${NC} Update complete!"
echo ""

$COMPOSE_CMD ps
