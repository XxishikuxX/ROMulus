#!/bin/bash

# EmuVerse Hardware Detection and Configuration
# Supports: Intel (CPU/GPU), AMD (CPU/GPU), NVIDIA (GPU), ARM (CPU)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detect CPU architecture and vendor
detect_cpu() {
    log_info "Detecting CPU..."
    
    ARCH=$(uname -m)
    CPU_VENDOR=""
    CPU_MODEL=""
    CPU_FLAGS=""
    
    if [[ -f /proc/cpuinfo ]]; then
        CPU_VENDOR=$(grep -m1 'vendor_id' /proc/cpuinfo | cut -d: -f2 | tr -d ' ' || echo "unknown")
        CPU_MODEL=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | sed 's/^[ \t]*//' || echo "unknown")
        CPU_FLAGS=$(grep -m1 'flags' /proc/cpuinfo | cut -d: -f2 || echo "")
    fi
    
    # ARM detection
    if [[ "$ARCH" == "aarch64" ]] || [[ "$ARCH" == "arm"* ]]; then
        CPU_TYPE="ARM"
        if [[ -f /proc/device-tree/model ]]; then
            ARM_MODEL=$(cat /proc/device-tree/model 2>/dev/null || echo "Generic ARM")
        else
            ARM_MODEL="Generic ARM64"
        fi
        log_info "Detected ARM CPU: $ARM_MODEL"
        
    elif [[ "$CPU_VENDOR" == "GenuineIntel" ]]; then
        CPU_TYPE="INTEL"
        log_info "Detected Intel CPU: $CPU_MODEL"
        
        # Check for specific Intel features
        if echo "$CPU_FLAGS" | grep -q "avx512"; then
            INTEL_FEATURES="AVX-512"
        elif echo "$CPU_FLAGS" | grep -q "avx2"; then
            INTEL_FEATURES="AVX2"
        elif echo "$CPU_FLAGS" | grep -q "avx"; then
            INTEL_FEATURES="AVX"
        else
            INTEL_FEATURES="SSE4"
        fi
        log_info "Intel CPU features: $INTEL_FEATURES"
        
    elif [[ "$CPU_VENDOR" == "AuthenticAMD" ]]; then
        CPU_TYPE="AMD"
        log_info "Detected AMD CPU: $CPU_MODEL"
        
        # Check for AMD features
        if echo "$CPU_FLAGS" | grep -q "avx512"; then
            AMD_FEATURES="AVX-512"
        elif echo "$CPU_FLAGS" | grep -q "avx2"; then
            AMD_FEATURES="AVX2"
        else
            AMD_FEATURES="AVX"
        fi
        log_info "AMD CPU features: $AMD_FEATURES"
        
    else
        CPU_TYPE="UNKNOWN"
        log_warning "Unknown CPU vendor: $CPU_VENDOR"
    fi
    
    export CPU_TYPE CPU_VENDOR CPU_MODEL ARCH
}

# Detect GPU
detect_gpu() {
    log_info "Detecting GPU..."
    
    GPU_TYPE="NONE"
    GPU_VENDOR=""
    GPU_MODEL=""
    
    # Check for NVIDIA GPU
    if lspci 2>/dev/null | grep -i nvidia > /dev/null; then
        GPU_TYPE="NVIDIA"
        GPU_MODEL=$(lspci | grep -i nvidia | head -1 | cut -d: -f3 | sed 's/^[ \t]*//')
        log_info "Detected NVIDIA GPU: $GPU_MODEL"
        
    # Check for AMD GPU
    elif lspci 2>/dev/null | grep -iE "amd|radeon|ati" | grep -i vga > /dev/null; then
        GPU_TYPE="AMD"
        GPU_MODEL=$(lspci | grep -iE "amd|radeon|ati" | grep -i vga | head -1 | cut -d: -f3 | sed 's/^[ \t]*//')
        log_info "Detected AMD GPU: $GPU_MODEL"
        
    # Check for Intel GPU
    elif lspci 2>/dev/null | grep -i intel | grep -iE "vga|display|graphics" > /dev/null; then
        GPU_TYPE="INTEL"
        GPU_MODEL=$(lspci | grep -i intel | grep -iE "vga|display|graphics" | head -1 | cut -d: -f3 | sed 's/^[ \t]*//')
        log_info "Detected Intel GPU: $GPU_MODEL"
        
    # ARM Mali/VideoCore/etc
    elif [[ "$ARCH" == "aarch64" ]] || [[ "$ARCH" == "arm"* ]]; then
        if [[ -d /sys/class/drm ]]; then
            GPU_TYPE="ARM_GPU"
            # Try to detect specific ARM GPU
            if lsmod 2>/dev/null | grep -q panfrost; then
                GPU_MODEL="ARM Mali (Panfrost)"
            elif lsmod 2>/dev/null | grep -q lima; then
                GPU_MODEL="ARM Mali (Lima)"
            elif lsmod 2>/dev/null | grep -q vc4; then
                GPU_MODEL="Broadcom VideoCore"
            elif lsmod 2>/dev/null | grep -q tegra; then
                GPU_MODEL="NVIDIA Tegra"
            else
                GPU_MODEL="Generic ARM GPU"
            fi
            log_info "Detected ARM GPU: $GPU_MODEL"
        fi
    fi
    
    # Fallback to software rendering
    if [[ "$GPU_TYPE" == "NONE" ]]; then
        log_warning "No dedicated GPU detected, will use software rendering"
        GPU_TYPE="SOFTWARE"
    fi
    
    export GPU_TYPE GPU_MODEL
}

# Install Intel drivers and libraries
install_intel_support() {
    log_info "Installing Intel support..."
    
    # Intel CPU optimizations
    apt-get install -y \
        intel-microcode \
        cpufrequtils \
        linux-tools-common \
        linux-tools-generic
    
    # Intel GPU drivers (integrated graphics)
    apt-get install -y \
        intel-media-va-driver \
        intel-media-va-driver-non-free \
        intel-gpu-tools \
        libva-drm2 \
        libva-x11-2 \
        libva2 \
        vainfo \
        i965-va-driver \
        mesa-va-drivers \
        libvdpau-va-gl1
    
    # Intel OpenCL
    apt-get install -y \
        intel-opencl-icd \
        ocl-icd-libopencl1 \
        clinfo || log_warning "Intel OpenCL packages may not be available"
    
    # Intel Vulkan
    apt-get install -y \
        mesa-vulkan-drivers \
        vulkan-tools
    
    # Intel Quick Sync Video for hardware encoding
    apt-get install -y \
        intel-media-va-driver-non-free \
        libmfx1 \
        libmfx-tools || log_warning "Intel Media SDK may not be available"
    
    # Intel oneAPI (for newer Intel hardware)
    if [[ -n "$INTEL_FEATURES" ]] && [[ "$INTEL_FEATURES" == "AVX-512" ]]; then
        log_info "Installing Intel oneAPI support for high-performance computing..."
        wget -qO- https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB | apt-key add - 2>/dev/null || true
        echo "deb https://apt.repos.intel.com/oneapi all main" > /etc/apt/sources.list.d/intel-oneapi.list 2>/dev/null || true
        apt-get update || true
        apt-get install -y intel-basekit 2>/dev/null || log_warning "Intel oneAPI not installed"
    fi
    
    log_success "Intel support installed"
}

# Install AMD drivers and libraries
install_amd_support() {
    log_info "Installing AMD support..."
    
    # AMD CPU optimizations
    apt-get install -y \
        amd64-microcode \
        cpufrequtils
    
    # AMD GPU drivers (AMDGPU)
    apt-get install -y \
        libdrm-amdgpu1 \
        xserver-xorg-video-amdgpu \
        mesa-va-drivers \
        mesa-vdpau-drivers \
        mesa-vulkan-drivers \
        libva-drm2 \
        libva2 \
        vainfo \
        vdpauinfo
    
    # AMD ROCm for compute (if supported)
    if lspci | grep -iE "radeon|amd" | grep -iE "vega|navi|rx [5-7]" > /dev/null 2>&1; then
        log_info "Detected AMD GPU with ROCm support, installing ROCm..."
        
        # Add ROCm repository
        wget -qO - https://repo.radeon.com/rocm/rocm.gpg.key | apt-key add - 2>/dev/null || true
        echo 'deb [arch=amd64] https://repo.radeon.com/rocm/apt/latest ubuntu main' > /etc/apt/sources.list.d/rocm.list 2>/dev/null || true
        apt-get update || true
        apt-get install -y rocm-hip-runtime rocm-opencl-runtime 2>/dev/null || log_warning "ROCm not installed"
    fi
    
    # AMD Vulkan (RADV)
    apt-get install -y \
        mesa-vulkan-drivers \
        vulkan-tools \
        libvulkan1
    
    # AMD AMF encoder support
    apt-get install -y \
        amf-amdgpu-pro 2>/dev/null || log_warning "AMD AMF encoder not available from repos"
    
    log_success "AMD support installed"
}

# Install NVIDIA drivers and libraries
install_nvidia_support() {
    log_info "Installing NVIDIA support..."
    
    # Add NVIDIA PPA
    add-apt-repository -y ppa:graphics-drivers/ppa || true
    apt-get update
    
    # Detect and install appropriate driver
    NVIDIA_DRIVER=""
    
    # Try to detect best driver
    if command -v ubuntu-drivers > /dev/null; then
        NVIDIA_DRIVER=$(ubuntu-drivers devices 2>/dev/null | grep -i nvidia | grep -i recommended | awk '{print $3}' | head -1)
    fi
    
    if [[ -z "$NVIDIA_DRIVER" ]]; then
        # Default to latest driver
        NVIDIA_DRIVER="nvidia-driver-545"
    fi
    
    log_info "Installing NVIDIA driver: $NVIDIA_DRIVER"
    apt-get install -y "$NVIDIA_DRIVER" || apt-get install -y nvidia-driver-535 || apt-get install -y nvidia-driver-525
    
    # NVIDIA CUDA
    apt-get install -y \
        nvidia-cuda-toolkit \
        nvidia-cuda-dev \
        libcudnn8 2>/dev/null || log_warning "CUDA toolkit may not be fully installed"
    
    # NVIDIA Vulkan
    apt-get install -y \
        nvidia-vulkan-icd \
        vulkan-tools \
        libvulkan1
    
    # NVIDIA NVENC for hardware encoding
    apt-get install -y \
        libnvidia-encode-545 \
        libnvidia-decode-545 2>/dev/null || \
    apt-get install -y \
        libnvidia-encode-535 \
        libnvidia-decode-535 2>/dev/null || log_warning "NVENC libs version mismatch"
    
    # NVIDIA Container Toolkit (for Docker)
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg 2>/dev/null || true
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
        sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
        tee /etc/apt/sources.list.d/nvidia-container-toolkit.list > /dev/null 2>&1 || true
    apt-get update || true
    apt-get install -y nvidia-container-toolkit 2>/dev/null || log_warning "NVIDIA Container Toolkit not installed"
    
    # Configure NVIDIA persistence
    nvidia-smi -pm 1 2>/dev/null || true
    
    log_success "NVIDIA support installed"
}

# Install ARM support
install_arm_support() {
    log_info "Installing ARM support..."
    
    # ARM-specific packages
    apt-get install -y \
        cpufrequtils \
        linux-firmware
    
    # Mali GPU drivers
    apt-get install -y \
        mesa-vulkan-drivers \
        libmali-* 2>/dev/null || true
    
    # Panfrost driver (open source Mali)
    apt-get install -y \
        mesa-vulkan-drivers \
        libdrm2
    
    # Video acceleration for ARM
    apt-get install -y \
        libva2 \
        libva-drm2 \
        mesa-va-drivers \
        ffmpeg
    
    # ARM NEON optimizations
    if grep -q "neon" /proc/cpuinfo 2>/dev/null; then
        log_info "ARM NEON detected, optimizations will be enabled"
    fi
    
    # Raspberry Pi specific
    if [[ -f /proc/device-tree/model ]] && grep -q "Raspberry" /proc/device-tree/model 2>/dev/null; then
        log_info "Detected Raspberry Pi, installing specific drivers..."
        apt-get install -y \
            libraspberrypi0 \
            libraspberrypi-dev \
            raspberrypi-kernel-headers 2>/dev/null || true
    fi
    
    # NVIDIA Jetson specific
    if [[ -f /etc/nv_tegra_release ]]; then
        log_info "Detected NVIDIA Jetson, using Tegra drivers..."
        # Jetson drivers are typically pre-installed
    fi
    
    log_success "ARM support installed"
}

# Configure hardware encoding
configure_encoding() {
    log_info "Configuring hardware video encoding..."
    
    ENCODER_TYPE="software"
    ENCODER_NAME="libx264"
    
    case "$GPU_TYPE" in
        "NVIDIA")
            if command -v nvidia-smi > /dev/null 2>&1; then
                # Check for NVENC support
                if nvidia-smi --query-gpu=encoder.stats.sessionCount --format=csv,noheader 2>/dev/null; then
                    ENCODER_TYPE="nvenc"
                    ENCODER_NAME="h264_nvenc"
                    log_info "NVIDIA NVENC hardware encoding enabled"
                fi
            fi
            ;;
        "AMD")
            # Check for AMD VCE/VCN
            if vainfo 2>/dev/null | grep -q "VAEntrypointEncSlice"; then
                ENCODER_TYPE="vaapi"
                ENCODER_NAME="h264_vaapi"
                log_info "AMD VAAPI hardware encoding enabled"
            fi
            ;;
        "INTEL")
            # Check for Intel Quick Sync
            if vainfo 2>/dev/null | grep -q "VAEntrypointEncSlice"; then
                ENCODER_TYPE="qsv"
                ENCODER_NAME="h264_qsv"
                log_info "Intel Quick Sync hardware encoding enabled"
            fi
            ;;
        "ARM_GPU")
            # Check for V4L2 M2M encoding
            if [[ -e /dev/video10 ]] || [[ -e /dev/video11 ]]; then
                ENCODER_TYPE="v4l2m2m"
                ENCODER_NAME="h264_v4l2m2m"
                log_info "ARM V4L2 M2M hardware encoding enabled"
            fi
            ;;
    esac
    
    # Save encoder configuration
    cat > /opt/emuverse/config/encoder.conf << ENCCONF
# EmuVerse Hardware Encoder Configuration
# Auto-generated based on detected hardware

ENCODER_TYPE=${ENCODER_TYPE}
ENCODER_NAME=${ENCODER_NAME}
GPU_TYPE=${GPU_TYPE}
GPU_MODEL=${GPU_MODEL}
CPU_TYPE=${CPU_TYPE}
CPU_MODEL=${CPU_MODEL}

# FFmpeg encoding presets
FFMPEG_ENCODER=${ENCODER_NAME}
FFMPEG_PRESET=fast
FFMPEG_CRF=23

# Streaming configuration
STREAMING_BITRATE=6000k
STREAMING_RESOLUTION=1920x1080
STREAMING_FPS=60
ENCCONF

    log_success "Hardware encoding configured: $ENCODER_TYPE ($ENCODER_NAME)"
    
    export ENCODER_TYPE ENCODER_NAME
}

# Configure emulator optimizations based on hardware
configure_emulator_optimizations() {
    log_info "Configuring emulator optimizations for detected hardware..."
    
    OPTIMIZATIONS_DIR="/opt/emuverse/config/optimizations"
    mkdir -p "$OPTIMIZATIONS_DIR"
    
    # Base configuration
    cat > "$OPTIMIZATIONS_DIR/hardware.conf" << HWCONF
# EmuVerse Hardware Configuration
# Auto-detected: $(date)

[System]
CPU_TYPE=${CPU_TYPE}
CPU_MODEL=${CPU_MODEL}
CPU_ARCH=${ARCH}
GPU_TYPE=${GPU_TYPE}
GPU_MODEL=${GPU_MODEL}

[Rendering]
HWCONF

    # GPU-specific rendering configuration
    case "$GPU_TYPE" in
        "NVIDIA")
            cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << NVIDIA_CONF
RENDERER=vulkan
VULKAN_DEVICE=nvidia
VSYNC=adaptive
SHADER_CACHE=on
NVIDIA_THREADED_OPTIMIZATION=on
__GL_SHADER_DISK_CACHE=1
__GL_SHADER_DISK_CACHE_PATH=/opt/emuverse/cache/nvidia
NVIDIA_CONF
            mkdir -p /opt/emuverse/cache/nvidia
            ;;
        "AMD")
            cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << AMD_CONF
RENDERER=vulkan
VULKAN_DEVICE=radv
VSYNC=on
SHADER_CACHE=on
RADV_PERFTEST=aco
mesa_glthread=true
AMD_VULKAN_ICD=RADV
AMD_CONF
            ;;
        "INTEL")
            cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << INTEL_CONF
RENDERER=vulkan
VULKAN_DEVICE=intel
VSYNC=on
SHADER_CACHE=on
MESA_LOADER_DRIVER_OVERRIDE=iris
ANV_ENABLE_PIPELINE_CACHE=1
INTEL_CONF
            ;;
        "ARM_GPU")
            cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << ARM_CONF
RENDERER=opengl
OPENGL_VERSION=3.2
VSYNC=on
SHADER_CACHE=on
PAN_MESA_DEBUG=
ARM_CONF
            ;;
        *)
            cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << SW_CONF
RENDERER=software
VSYNC=off
SHADER_CACHE=off
SW_CONF
            ;;
    esac
    
    # CPU-specific optimizations
    cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << CPU_CONF

[CPU_Optimizations]
CPU_CONF

    case "$CPU_TYPE" in
        "INTEL")
            cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << INTEL_CPU
THREAD_SCHEDULER=intel
USE_AVX=${INTEL_FEATURES:-SSE4}
INTEL_PSTATE=performance
INTEL_CPU
            ;;
        "AMD")
            cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << AMD_CPU
THREAD_SCHEDULER=amd
USE_AVX=${AMD_FEATURES:-AVX}
AMD_PSTATE=performance
AMD_CPU
            ;;
        "ARM")
            cat >> "$OPTIMIZATIONS_DIR/hardware.conf" << ARM_CPU
THREAD_SCHEDULER=arm
USE_NEON=on
ARM_CPU
            ;;
    esac
    
    # Per-emulator optimizations
    create_emulator_configs
    
    log_success "Emulator optimizations configured"
}

# Create per-emulator configuration files
create_emulator_configs() {
    log_info "Creating per-emulator configuration files..."
    
    # RetroArch configuration
    cat > "$OPTIMIZATIONS_DIR/retroarch.cfg" << RETROARCH
# RetroArch Hardware-Optimized Configuration

video_driver = "$([ "$GPU_TYPE" == "SOFTWARE" ] && echo "sdl2" || echo "vulkan")"
video_context_driver = "$([ "$GPU_TYPE" == "ARM_GPU" ] && echo "khr_display" || echo "auto")"
video_vsync = "true"
video_max_swapchain_images = "3"
video_frame_delay = "0"
video_threaded = "$([ "$GPU_TYPE" == "SOFTWARE" ] && echo "true" || echo "false")"

# Hardware encoding
video_gpu_record = "$([ "$GPU_TYPE" != "SOFTWARE" ] && echo "true" || echo "false")"
video_record_threads = "4"

# Audio
audio_driver = "pulse"
audio_latency = "64"

# Performance
menu_driver = "ozone"
threaded_data_runloop_enable = "true"
RETROARCH

    # PCSX2 configuration (PS2)
    cat > "$OPTIMIZATIONS_DIR/pcsx2.ini" << PCSX2
[EmuCore/GS]
Renderer = $([ "$GPU_TYPE" == "SOFTWARE" ] && echo "-1" || echo "14")  # Vulkan
upscale_multiplier = 3
texture_filtering = 2
MaxAnisotropy = 16

[EmuCore/Speedhacks]
EECycleRate = 0
EECycleSkip = 0
fastCDVD = true
IntcStat = true
WaitLoop = true
vuFlagHack = true
vuThread = true

[EmuCore]
EnableCheats = false
EnableWideScreenPatches = true
PCSX2

    # RPCS3 configuration (PS3)
    cat > "$OPTIMIZATIONS_DIR/rpcs3_config.yml" << RPCS3
Core:
  PPU Decoder: Recompiler (LLVM)
  SPU Decoder: Recompiler (LLVM)
  SPU XFloat Accuracy: Approximate
  Enable SPU Loop Detection: true
  SPU Threads: $(nproc)
  
Video:
  Renderer: $([ "$GPU_TYPE" == "SOFTWARE" ] && echo "OpenGL" || echo "Vulkan")
  Resolution Scale: 150
  Shader Mode: Async with Shader Interpreter
  VSync: true
  Strict Rendering Mode: false
  
Audio:
  Audio Out: Cubeb
  Audio Buffer Duration: 50
  Enable Time Stretching: true
RPCS3

    # Dolphin configuration (Wii/GameCube)
    cat > "$OPTIMIZATIONS_DIR/dolphin.ini" << DOLPHIN
[Core]
CPUCore = 1
Fastmem = True
DSPHLE = True
SyncGPU = True
SyncGpuMaxDistance = 200000
SyncGpuMinDistance = -200000

[Video_Settings]
Adapter = 0
BackendMultithreading = True

[Video_Hardware]
VSync = True

[Video_Enhancements]
InternalResolution = 3
MaxAnisotropy = 4
DOLPHIN

    # Cemu configuration (Wii U)
    cat > "$OPTIMIZATIONS_DIR/cemu_settings.xml" << CEMU
<?xml version="1.0" encoding="utf-8"?>
<content>
    <Graphic>
        <api>$([ "$GPU_TYPE" == "SOFTWARE" ] && echo "1" || echo "0")</api>
        <VSync>true</VSync>
        <UpscaleFilter>1</UpscaleFilter>
        <DownscaleFilter>1</DownscaleFilter>
    </Graphic>
    <Audio>
        <api>3</api>
        <delay>2</delay>
    </Audio>
    <cpu>
        <cpuMode>2</cpuMode>
        <cpuAffinity>0</cpuAffinity>
    </cpu>
</content>
CEMU

    log_success "Per-emulator configurations created"
}

# Create environment setup script
create_env_script() {
    log_info "Creating environment setup script..."
    
    cat > /opt/emuverse/scripts/setup_env.sh << 'ENVSCRIPT'
#!/bin/bash
# EmuVerse Environment Setup
# Source this file before running emulators

# Load hardware configuration
if [[ -f /opt/emuverse/config/optimizations/hardware.conf ]]; then
    source /opt/emuverse/config/optimizations/hardware.conf
fi

# Load encoder configuration
if [[ -f /opt/emuverse/config/encoder.conf ]]; then
    source /opt/emuverse/config/encoder.conf
fi

# Set GPU-specific environment variables
case "$GPU_TYPE" in
    "NVIDIA")
        export __GL_SHADER_DISK_CACHE=1
        export __GL_SHADER_DISK_CACHE_PATH=/opt/emuverse/cache/nvidia
        export __GL_THREADED_OPTIMIZATION=1
        export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
        ;;
    "AMD")
        export RADV_PERFTEST=aco
        export mesa_glthread=true
        export AMD_VULKAN_ICD=RADV
        export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json
        ;;
    "INTEL")
        export MESA_LOADER_DRIVER_OVERRIDE=iris
        export ANV_ENABLE_PIPELINE_CACHE=1
        export INTEL_DEBUG=
        export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/intel_icd.x86_64.json
        ;;
esac

# Common settings
export SDL_AUDIODRIVER=pulse
export SDL_VIDEODRIVER=x11
export DISPLAY=${DISPLAY:-:99}

# Performance governor
if [[ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]]; then
    echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null 2>&1 || true
fi

echo "EmuVerse environment configured for $GPU_TYPE GPU on $CPU_TYPE CPU"
ENVSCRIPT

    chmod +x /opt/emuverse/scripts/setup_env.sh
    
    log_success "Environment setup script created"
}

# Main hardware setup function
setup_hardware() {
    log_info "Starting comprehensive hardware setup..."
    
    # Create directories
    mkdir -p /opt/emuverse/{config,cache,scripts}
    mkdir -p /opt/emuverse/config/optimizations
    
    # Detect hardware
    detect_cpu
    detect_gpu
    
    # Install appropriate drivers
    case "$CPU_TYPE" in
        "INTEL") install_intel_support ;;
        "AMD") install_amd_support ;;
        "ARM") install_arm_support ;;
    esac
    
    case "$GPU_TYPE" in
        "NVIDIA") install_nvidia_support ;;
        "AMD") 
            if [[ "$CPU_TYPE" != "AMD" ]]; then
                install_amd_support
            fi
            ;;
        "INTEL")
            if [[ "$CPU_TYPE" != "INTEL" ]]; then
                install_intel_support
            fi
            ;;
        "ARM_GPU") 
            if [[ "$CPU_TYPE" != "ARM" ]]; then
                install_arm_support
            fi
            ;;
    esac
    
    # Install common video/graphics libraries
    apt-get install -y \
        libgl1-mesa-glx \
        libgl1-mesa-dri \
        libegl1-mesa \
        libgles2-mesa \
        mesa-utils \
        vulkan-tools \
        libvulkan1 \
        libvdpau1 \
        vdpauinfo
    
    # Configure encoding and optimizations
    configure_encoding
    configure_emulator_optimizations
    create_env_script
    
    # Generate hardware report
    generate_hardware_report
    
    log_success "Hardware setup completed!"
}

# Generate hardware report
generate_hardware_report() {
    REPORT_FILE="/opt/emuverse/config/hardware_report.txt"
    
    cat > "$REPORT_FILE" << REPORT
================================================================================
                        EmuVerse Hardware Report
                        Generated: $(date)
================================================================================

CPU Information:
  Type:     ${CPU_TYPE}
  Model:    ${CPU_MODEL}
  Arch:     ${ARCH}
  Cores:    $(nproc)

GPU Information:
  Type:     ${GPU_TYPE}
  Model:    ${GPU_MODEL}

Video Encoding:
  Encoder:  ${ENCODER_NAME}
  Type:     ${ENCODER_TYPE}

Vulkan Support:
$(vulkaninfo --summary 2>/dev/null || echo "  Vulkan not available")

OpenGL Support:
$(glxinfo 2>/dev/null | grep "OpenGL version" || echo "  OpenGL info not available")

VAAPI Support:
$(vainfo 2>/dev/null | head -20 || echo "  VAAPI not available")

================================================================================
REPORT

    log_info "Hardware report saved to: $REPORT_FILE"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
    setup_hardware
fi
