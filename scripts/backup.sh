#!/bin/bash
# ROMulus - Backup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors
GREEN='\033[0;32m'
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
INCLUDE_ROMS=false
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --include-roms)
            INCLUDE_ROMS=true
            shift
            ;;
        -o|--output)
            OUTPUT_DIR=$2
            shift 2
            ;;
        -h|--help)
            echo "Usage: ./backup.sh [options]"
            echo ""
            echo "Options:"
            echo "  --include-roms  Include ROM files (can be very large)"
            echo "  -o, --output    Output directory (default: ./backups)"
            echo "  -h, --help      Show this help"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

if [ -n "$OUTPUT_DIR" ]; then
    BACKUP_DIR="$OUTPUT_DIR"
fi

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   💾 ROMulus Backup                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "${PROJECT_DIR}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"
BACKUP_PATH="${BACKUP_DIR}/romulus-backup-${TIMESTAMP}"
mkdir -p "${BACKUP_PATH}"

# Backup database
echo -e "${BLUE}[INFO]${NC} Backing up database..."
$COMPOSE_CMD exec -T postgres pg_dump -U romulus romulus > "${BACKUP_PATH}/database.sql" 2>/dev/null || {
    echo -e "${YELLOW}[WARNING]${NC} Could not backup database (is it running?)"
}

# Backup configuration
echo -e "${BLUE}[INFO]${NC} Backing up configuration..."
cp "${PROJECT_DIR}/.env" "${BACKUP_PATH}/" 2>/dev/null || true

# Backup saves and states
echo -e "${BLUE}[INFO]${NC} Backing up saves and states..."
cp -r "${PROJECT_DIR}/data/saves" "${BACKUP_PATH}/" 2>/dev/null || true
cp -r "${PROJECT_DIR}/data/states" "${BACKUP_PATH}/" 2>/dev/null || true

# Backup covers and screenshots
echo -e "${BLUE}[INFO]${NC} Backing up media..."
cp -r "${PROJECT_DIR}/data/covers" "${BACKUP_PATH}/" 2>/dev/null || true
cp -r "${PROJECT_DIR}/data/screenshots" "${BACKUP_PATH}/" 2>/dev/null || true

# Optionally backup ROMs
if [ "$INCLUDE_ROMS" = true ]; then
    echo -e "${BLUE}[INFO]${NC} Backing up ROMs (this may take a while)..."
    cp -r "${PROJECT_DIR}/data/roms" "${BACKUP_PATH}/" 2>/dev/null || true
    cp -r "${PROJECT_DIR}/data/bios" "${BACKUP_PATH}/" 2>/dev/null || true
fi

# Create archive
echo -e "${BLUE}[INFO]${NC} Creating archive..."
cd "${BACKUP_DIR}"
tar -czf "romulus-backup-${TIMESTAMP}.tar.gz" "romulus-backup-${TIMESTAMP}"
rm -rf "romulus-backup-${TIMESTAMP}"

BACKUP_FILE="${BACKUP_DIR}/romulus-backup-${TIMESTAMP}.tar.gz"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo -e "${GREEN}[SUCCESS]${NC} Backup complete!"
echo ""
echo -e "${YELLOW}Backup file:${NC} ${BACKUP_FILE}"
echo -e "${YELLOW}Size:${NC} ${BACKUP_SIZE}"
echo ""
echo "To restore, run: ./scripts/restore.sh ${BACKUP_FILE}"
