#!/bin/bash
# ===========================================
# ROMulus Mobile - APK Build Script
# ===========================================
# This script builds APKs for all supported Android devices
# 
# Prerequisites:
#   - Node.js 18+
#   - Java JDK 17+
#   - Android SDK (or Android Studio)
#   - Set ANDROID_HOME environment variable
#
# Usage:
#   ./build-apk.sh              # Build standard release APK
#   ./build-apk.sh debug        # Build debug APK
#   ./build-apk.sh anbernic     # Build Anbernic-optimized APK
#   ./build-apk.sh all          # Build all device variants
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
OUTPUT_DIR="$PROJECT_DIR/builds"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║     ROMulus Mobile - APK Builder         ║"
echo "║           👑 Version 2.3.0               ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
        exit 1
    fi
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js 18+ required. Found: $(node -v)${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
    
    # Check Java
    if ! command -v java &> /dev/null; then
        echo -e "${RED}❌ Java not found. Please install JDK 17+${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Java $(java -version 2>&1 | head -n 1)${NC}"
    
    # Check Android SDK
    if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
        # Try common locations
        if [ -d "$HOME/Android/Sdk" ]; then
            export ANDROID_HOME="$HOME/Android/Sdk"
        elif [ -d "$HOME/Library/Android/sdk" ]; then
            export ANDROID_HOME="$HOME/Library/Android/sdk"
        elif [ -d "/usr/local/android-sdk" ]; then
            export ANDROID_HOME="/usr/local/android-sdk"
        else
            echo -e "${RED}❌ Android SDK not found. Please set ANDROID_HOME${NC}"
            exit 1
        fi
    fi
    export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
    echo -e "${GREEN}✓ Android SDK: $ANDROID_HOME${NC}"
}

# Install dependencies
install_dependencies() {
    echo ""
    echo -e "${YELLOW}Installing dependencies...${NC}"
    
    cd "$PROJECT_DIR"
    
    if [ ! -d "node_modules" ]; then
        npm install
    else
        echo -e "${GREEN}✓ Dependencies already installed${NC}"
    fi
}

# Build APK
build_apk() {
    local VARIANT="${1:-standard}"
    local BUILD_TYPE="${2:-release}"
    
    echo ""
    echo -e "${CYAN}Building APK: ${VARIANT} (${BUILD_TYPE})${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    cd "$PROJECT_DIR/android"
    
    # Clean previous builds
    if [ "$BUILD_TYPE" == "release" ]; then
        ./gradlew clean
    fi
    
    # Determine gradle task
    local TASK=""
    case "$VARIANT" in
        "standard")
            TASK="assembleStandard${BUILD_TYPE^}"
            ;;
        "anbernic")
            TASK="assembleAnbernic${BUILD_TYPE^}"
            ;;
        "retroid")
            TASK="assembleRetroid${BUILD_TYPE^}"
            ;;
        "ayaneo")
            TASK="assembleAyaneo${BUILD_TYPE^}"
            ;;
        "gcloud")
            TASK="assembleGcloud${BUILD_TYPE^}"
            ;;
        "razeredge")
            TASK="assembleRazeredge${BUILD_TYPE^}"
            ;;
        "all")
            TASK="buildAllDevices"
            ;;
        "debug")
            TASK="assembleDebug"
            ;;
        *)
            echo -e "${RED}Unknown variant: $VARIANT${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${YELLOW}Running: ./gradlew $TASK${NC}"
    ./gradlew $TASK
    
    # Copy APKs to output directory
    mkdir -p "$OUTPUT_DIR"
    
    echo ""
    echo -e "${GREEN}✓ Build complete!${NC}"
    echo ""
    echo -e "${CYAN}APK files:${NC}"
    
    find app/build/outputs/apk -name "*.apk" -exec cp {} "$OUTPUT_DIR/" \; 2>/dev/null || true
    ls -la "$OUTPUT_DIR"/*.apk 2>/dev/null || echo "APKs in: app/build/outputs/apk/"
}

# Create signing keystore
create_keystore() {
    echo ""
    echo -e "${YELLOW}Creating release keystore...${NC}"
    
    cd "$PROJECT_DIR/android"
    
    if [ -f "romulus.keystore" ]; then
        echo -e "${GREEN}✓ Keystore already exists${NC}"
        return
    fi
    
    keytool -genkeypair \
        -v \
        -storetype PKCS12 \
        -keystore romulus.keystore \
        -alias romulus \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=ROMulus, OU=Mobile, O=ROMulus, L=Unknown, ST=Unknown, C=US"
    
    # Create keystore.properties
    cat > keystore.properties << EOF
storeFile=romulus.keystore
storePassword=romulus123
keyAlias=romulus
keyPassword=romulus123
EOF
    
    echo -e "${GREEN}✓ Keystore created${NC}"
    echo -e "${YELLOW}⚠ Change the default passwords for production!${NC}"
}

# Print usage
print_usage() {
    echo "Usage: $0 [variant] [options]"
    echo ""
    echo "Variants:"
    echo "  standard    - Standard Android phones/tablets (default)"
    echo "  anbernic    - Optimized for Anbernic handhelds"
    echo "  retroid     - Optimized for Retroid handhelds"
    echo "  ayaneo      - Optimized for AYANEO handhelds"
    echo "  gcloud      - Optimized for Logitech G Cloud"
    echo "  razeredge   - Optimized for Razer Edge"
    echo "  all         - Build all variants"
    echo "  debug       - Debug build (faster, larger)"
    echo ""
    echo "Options:"
    echo "  --keystore  - Create release signing keystore"
    echo "  --clean     - Clean build before compiling"
    echo "  --help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build standard release APK"
    echo "  $0 anbernic           # Build Anbernic-optimized APK"
    echo "  $0 all                # Build all device variants"
    echo "  $0 debug              # Build debug APK"
}

# Main
main() {
    local VARIANT="standard"
    local BUILD_TYPE="release"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help|-h)
                print_usage
                exit 0
                ;;
            --keystore)
                check_prerequisites
                create_keystore
                exit 0
                ;;
            --clean)
                cd "$PROJECT_DIR/android" && ./gradlew clean
                shift
                ;;
            debug)
                BUILD_TYPE="debug"
                shift
                ;;
            standard|anbernic|retroid|ayaneo|gcloud|razeredge|all)
                VARIANT="$1"
                shift
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                print_usage
                exit 1
                ;;
        esac
    done
    
    check_prerequisites
    install_dependencies
    
    if [ "$BUILD_TYPE" == "release" ] && [ ! -f "$PROJECT_DIR/android/romulus.keystore" ]; then
        echo -e "${YELLOW}No keystore found. Creating one...${NC}"
        create_keystore
    fi
    
    build_apk "$VARIANT" "$BUILD_TYPE"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         Build Complete! 🎉               ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo "APK location: $OUTPUT_DIR/"
    echo ""
    echo "To install on device:"
    echo "  adb install $OUTPUT_DIR/ROMulus-*.apk"
    echo ""
    echo "Or transfer the APK to your device and install manually."
}

main "$@"
