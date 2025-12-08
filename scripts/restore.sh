#!/bin/bash
# ROMulus - Restore Script

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

# Check arguments
if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup-file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -lh "${PROJECT_DIR}/backups/"*.tar.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}[ERROR]${NC} Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   📥 ROMulus Restore                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}[WARNING]${NC} This will overwrite existing data!"
read -p "Are you sure? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

cd "${PROJECT_DIR}"

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Extract backup
echo -e "${BLUE}[INFO]${NC} Extracting backup..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

BACKUP_DIR=$(ls "$TEMP_DIR")

# Stop services
echo -e "${BLUE}[INFO]${NC} Stopping services..."
$COMPOSE_CMD down

# Restore database
if [ -f "$TEMP_DIR/$BACKUP_DIR/database.sql" ]; then
    echo -e "${BLUE}[INFO]${NC} Restoring database..."
    $COMPOSE_CMD up -d postgres
    sleep 5
    $COMPOSE_CMD exec -T postgres psql -U romulus romulus < "$TEMP_DIR/$BACKUP_DIR/database.sql"
    $COMPOSE_CMD down
fi

# Restore saves
if [ -d "$TEMP_DIR/$BACKUP_DIR/saves" ]; then
    echo -e "${BLUE}[INFO]${NC} Restoring saves..."
    rm -rf "${PROJECT_DIR}/data/saves"
    cp -r "$TEMP_DIR/$BACKUP_DIR/saves" "${PROJECT_DIR}/data/"
fi

# Restore states
if [ -d "$TEMP_DIR/$BACKUP_DIR/states" ]; then
    echo -e "${BLUE}[INFO]${NC} Restoring states..."
    rm -rf "${PROJECT_DIR}/data/states"
    cp -r "$TEMP_DIR/$BACKUP_DIR/states" "${PROJECT_DIR}/data/"
fi

# Restore covers
if [ -d "$TEMP_DIR/$BACKUP_DIR/covers" ]; then
    echo -e "${BLUE}[INFO]${NC} Restoring covers..."
    rm -rf "${PROJECT_DIR}/data/covers"
    cp -r "$TEMP_DIR/$BACKUP_DIR/covers" "${PROJECT_DIR}/data/"
fi

# Restore screenshots
if [ -d "$TEMP_DIR/$BACKUP_DIR/screenshots" ]; then
    echo -e "${BLUE}[INFO]${NC} Restoring screenshots..."
    rm -rf "${PROJECT_DIR}/data/screenshots"
    cp -r "$TEMP_DIR/$BACKUP_DIR/screenshots" "${PROJECT_DIR}/data/"
fi

# Restore ROMs if present
if [ -d "$TEMP_DIR/$BACKUP_DIR/roms" ]; then
    echo -e "${BLUE}[INFO]${NC} Restoring ROMs..."
    rm -rf "${PROJECT_DIR}/data/roms"
    cp -r "$TEMP_DIR/$BACKUP_DIR/roms" "${PROJECT_DIR}/data/"
fi

# Restore BIOS if present
if [ -d "$TEMP_DIR/$BACKUP_DIR/bios" ]; then
    echo -e "${BLUE}[INFO]${NC} Restoring BIOS files..."
    rm -rf "${PROJECT_DIR}/data/bios"
    cp -r "$TEMP_DIR/$BACKUP_DIR/bios" "${PROJECT_DIR}/data/"
fi

# Start services
echo -e "${BLUE}[INFO]${NC} Starting services..."
$COMPOSE_CMD up -d

echo ""
echo -e "${GREEN}[SUCCESS]${NC} Restore complete!"
echo ""

$COMPOSE_CMD ps
