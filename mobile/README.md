# ROMulus Mobile App

## 📱 Multi-Platform Remote Play Client

This directory contains the mobile/handheld client for ROMulus remote play.

### Supported Platforms

| Platform | Status | Technology |
|----------|--------|------------|
| Android Phones | ✅ Supported | React Native |
| Android Tablets | ✅ Supported | React Native |
| Anbernic Devices | ✅ Supported | Android APK |
| Retroid Pocket | ✅ Supported | Android APK |
| AYANEO | ✅ Supported | Android APK |
| ASUS ROG Ally | ✅ Supported | Windows PWA/Electron |
| Steam Deck | ✅ Supported | Linux Flatpak |
| iOS/iPad | ✅ Supported | React Native |
| Web Browser | ✅ Supported | PWA |

### Features

- 🎮 **Virtual Gamepad** - On-screen touch controls
- 🎯 **Physical Controller Support** - Bluetooth/USB controllers
- 📺 **Adaptive Streaming** - Auto-adjusts quality based on connection
- 🔊 **Low Latency Audio** - Opus codec streaming
- 💾 **Cloud Saves** - Seamless save sync
- 🏆 **Achievements** - RetroAchievements integration
- 👥 **Multiplayer** - Join lobbies remotely
- 📴 **Offline Mode** - Download games for offline play (optional)

### Quick Start

```bash
# Install dependencies
npm install

# Run on Android
npm run android

# Run on iOS
npm run ios

# Build APK for handhelds
npm run build:android
```

### Controller Mapping

The app auto-detects and maps these controllers:

- Xbox Controllers (Bluetooth/USB)
- PlayStation DualShock/DualSense
- 8BitDo Controllers
- Nintendo Switch Pro Controller
- Built-in controls (ROG Ally, Steam Deck, Anbernic)
- Generic HID gamepads

### Network Requirements

| Quality | Bandwidth | Latency |
|---------|-----------|---------|
| 720p 30fps | 5 Mbps | < 100ms |
| 720p 60fps | 10 Mbps | < 50ms |
| 1080p 30fps | 15 Mbps | < 100ms |
| 1080p 60fps | 25 Mbps | < 50ms |

### Building for Handhelds

#### Anbernic/Retroid (Android)
```bash
npm run build:android
# APK will be in android/app/build/outputs/apk/release/
# Transfer to device and install
```

#### ROG Ally (Windows)
```bash
npm run build:windows
# Installs as a Windows app with controller support
```

#### Steam Deck
```bash
npm run build:linux
# Add as non-Steam game or install Flatpak
```
