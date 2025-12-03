# 👑 ROMulus

<div align="center">

<img src="frontend/public/logo.png" alt="ROMulus Logo" width="200" />

**A self-hosted multi-emulation platform with remote play capabilities**

[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?style=flat-square&logo=ubuntu&logoColor=white)](https://ubuntu.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com/)

[Features](#-features) • [Installation](#-installation) • [Configuration](#-configuration) • [Usage](#-usage) • [API Docs](#-api-documentation)

</div>

---

## ✨ Features

### 🕹️ Supported Systems (25+)
| Nintendo | Sony | Sega | Other |
|----------|------|------|-------|
| NES / Famicom | PlayStation 1 | Master System | Atari 2600/7800 |
| SNES | PlayStation 2 | Genesis / Mega Drive | Neo Geo |
| Nintendo 64 | PlayStation 3 | Saturn | TurboGrafx-16 |
| GameCube | PSP | Dreamcast | Arcade (MAME) |
| Wii / Wii U | PS Vita | Game Gear | |
| Game Boy / Color / Advance | | Sega CD / 32X | |
| DS / DSi / 3DS | | | |

### 🌟 Key Features
- **🌐 Remote Play** - Stream games to any device via WebRTC
- **☁️ Cloud Saves** - Automatic save synchronization across devices
- **🏆 RetroAchievements** - Full integration with RetroAchievements.org
- **👥 Multiplayer** - Netplay with rollback netcode support
- **🎨 CRT Shaders** - 15+ visual filters for authentic retro look
- **⚡ Run-Ahead** - Input lag reduction technology
- **🔄 Rewind** - Instant rewind functionality
- **📊 Statistics** - Track playtime, achievements, and more
- **👫 Social** - Friends, lobbies, and community features
- **🛡️ Admin Panel** - Complete ROM and user management

---

## 📋 Requirements

### Minimum Hardware
- **CPU**: 4 cores (8 recommended for PS2/PS3/Wii U)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 50GB+ for ROMs and saves
- **GPU**: Any with OpenGL 3.3+ (dedicated GPU recommended)

### Software Requirements
- Ubuntu Server 24.04 LTS (or compatible)
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

---

## 🚀 Installation

### Quick Install (Recommended)

```bash
# Clone the repository
git clone https://github.com/XxishikuxX/ROMulus.git
cd romulus

# Run the installer
chmod +x scripts/install.sh
sudo ./scripts/install.sh
```

The installer will:
1. Detect your hardware (CPU, GPU, architecture)
2. Install required dependencies
3. Set up the database
4. Configure emulator cores
5. Build and start the application

### Docker Installation

```bash
# Clone the repository
git clone https://github.com/XxishikuxX/ROMulus.git
cd romulus

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env

# Start with Docker Compose
docker-compose up -d
```

### Manual Installation

<details>
<summary>Click to expand manual installation steps</summary>

#### 1. Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install build tools
sudo apt install -y build-essential git cmake
```

#### 2. Clone and Setup

```bash
# Clone repository
git clone https://github.com/XxishikuxX/ROMulus.git
cd romulus

# Install backend dependencies
cd backend
npm install

# Setup database
cp .env.example .env
# Edit .env with your database credentials
npx prisma migrate deploy
npx prisma generate

# Install frontend dependencies
cd ../frontend
npm install
```

#### 3. Configure Environment

```bash
# Backend .env
DATABASE_URL="postgresql://user:password@localhost:5432/romulus"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secure-secret-key"
PORT=3000

# Frontend .env
VITE_API_URL="http://localhost:3000/api"
```

#### 4. Build and Run

```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd ../backend
npm run build
npm start
```

</details>

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://romulus:password@localhost:5432/romulus
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-change-this
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGIN=http://localhost:5173

# File Storage
UPLOAD_DIR=/opt/romulus/data
MAX_ROM_SIZE=4GB

# RetroAchievements (Optional)
RA_API_KEY=your-retroachievements-api-key

# Streaming (Optional)
ENABLE_STREAMING=true
STUN_SERVER=stun:stun.l.google.com:19302
```

### Directory Structure

```
/opt/romulus/
├── data/
│   ├── roms/           # ROM files organized by system
│   │   ├── nes/
│   │   ├── snes/
│   │   ├── n64/
│   │   └── ...
│   ├── bios/           # BIOS files for emulators
│   │   ├── ps1/
│   │   ├── ps2/
│   │   └── ...
│   ├── saves/          # User save files
│   ├── states/         # Save states
│   ├── covers/         # Game cover art
│   └── screenshots/    # Game screenshots
├── cores/              # Emulator cores (LibRetro)
├── logs/               # Application logs
└── config/             # Configuration files
```

---

## 🎮 Usage

### Accessing the Web Interface

After installation, access ROMulus at:
- **Local**: `http://localhost:5173`
- **Network**: `http://your-server-ip:5173`

### Default Admin Account

```
Email: admin@romulus.local
Password: admin123
```

⚠️ **Change the default password immediately after first login!**

### Adding ROMs

1. **Web Upload**: Go to Admin Panel → ROMs → Upload
2. **Direct Copy**: Place ROMs in `/opt/romulus/data/roms/{system}/`
3. **Bulk Import**: Use the admin CLI tool

```bash
# Scan and import ROMs
npm run cli -- scan-roms
```

---

## 📚 API Documentation

Full API documentation available at `/api/docs` when running.

See [docs/API_DOCS.md](docs/API_DOCS.md) for complete documentation.

---

## 🐛 Troubleshooting

### Logs

```bash
# Application logs
tail -f /opt/romulus/logs/app.log

# Docker logs
docker-compose logs -f
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

**Note**: This software does not include any copyrighted ROMs or BIOS files.

---

<div align="center">

**[⬆ Back to Top](#-romulus)**

Made with ❤️ for retro gaming enthusiasts

</div>
