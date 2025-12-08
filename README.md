# 👑 ROMulus

<p align="center">
  <img src="frontend/public/logo.png" alt="ROMulus Logo" width="200">
</p>

<p align="center">
  <strong>Web-Based Multi-Emulation Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-Required-2496ED?style=flat&logo=docker" alt="Docker Required">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js" alt="Node.js 20+">
</p>

---

## 🎮 What is ROMulus?

ROMulus is a self-hosted, web-based retro gaming platform that runs entirely in Docker. Stream and play classic games from any device with a web browser.

### ✨ Features

- 🌐 **Web-Based** - Play from any browser, no client installation
- 🎮 **30+ Systems** - Nintendo, PlayStation, Sega, Xbox, and more
- 👥 **Multiplayer** - Online netplay and local co-op
- 🏆 **Achievements** - RetroAchievements integration
- ☁️ **Cloud Saves** - Sync saves across devices
- 🎨 **CRT Shaders** - Authentic retro look
- 👤 **User Accounts** - Multi-user with profiles
- 🔧 **Admin Panel** - Manage ROMs, users, and settings

---

## 🚀 Quick Start

### Prerequisites

- **Docker** (with Docker Compose)
- **4GB+ RAM** recommended
- **50GB+ Storage** for ROMs

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ROMulus.git
cd ROMulus

# Make scripts executable
chmod +x scripts/*.sh

# Install and start
./scripts/install.sh
```

That's it! Access ROMulus at `http://localhost`

### Default Login

- **Email:** `admin@romulus.local`
- **Password:** `admin123`

⚠️ **Change the default password immediately!**

---

## 📦 Supported Systems

| Nintendo | Sony | Sega | Other |
|----------|------|------|-------|
| NES | PlayStation 1 | Genesis/Mega Drive | Arcade |
| SNES | PlayStation 2 | Saturn | Neo Geo |
| N64 | PlayStation 3 | Dreamcast | TurboGrafx-16 |
| GameCube | PSP | Master System | Atari 2600/7800 |
| Wii / Wii U | PS Vita | Game Gear | |
| Game Boy / GBC / GBA | | Sega CD / 32X | |
| DS / DSi / 3DS | | | |
| Xbox / Xbox 360 | | | |

---

## 📁 Directory Structure

```
ROMulus/
├── docker-compose.yml    # Docker configuration
├── .env                  # Environment variables
├── data/                 # Persistent data
│   ├── roms/            # ROM files by system
│   │   ├── nes/
│   │   ├── snes/
│   │   ├── ps1/
│   │   └── ...
│   ├── bios/            # BIOS files
│   ├── saves/           # Game saves
│   ├── states/          # Save states
│   ├── covers/          # Box art
│   └── screenshots/     # Screenshots
├── backend/             # API server
├── frontend/            # Web interface
├── nginx/               # Nginx configuration
└── scripts/             # Management scripts
```

---

## 🛠 Management Scripts

| Script | Description |
|--------|-------------|
| `./scripts/install.sh` | Initial setup and installation |
| `./scripts/start.sh` | Start all services |
| `./scripts/stop.sh` | Stop all services |
| `./scripts/restart.sh` | Restart services |
| `./scripts/status.sh` | Check service status |
| `./scripts/logs.sh` | View logs |
| `./scripts/update.sh` | Update to latest version |
| `./scripts/backup.sh` | Backup data and database |
| `./scripts/restore.sh` | Restore from backup |

### Examples

```bash
# View backend logs
./scripts/logs.sh backend -f

# Restart only the backend
./scripts/restart.sh backend

# Check status
./scripts/status.sh

# Create backup
./scripts/backup.sh

# Update ROMulus
./scripts/update.sh
```

---

## 🎮 Adding ROMs

### Method 1: Web Upload
1. Log in to ROMulus
2. Go to **Library** → **Upload**
3. Select ROMs to upload

### Method 2: Direct Copy
```bash
# Copy ROMs to the appropriate folder
cp my-game.nes ./data/roms/nes/
cp my-game.sfc ./data/roms/snes/
cp my-game.iso ./data/roms/ps1/
```

### Method 3: SFTP/SCP
```bash
scp game.nes user@server:~/ROMulus/data/roms/nes/
```

---

## 🔧 BIOS Files

Some systems require BIOS files:

| System | Files | Location |
|--------|-------|----------|
| PS1 | `scph1001.bin` | `data/bios/ps1/` |
| PS2 | `bios.bin` | `data/bios/ps2/` |
| Dreamcast | `dc_boot.bin`, `dc_flash.bin` | `data/bios/dreamcast/` |
| Saturn | `saturn_bios.bin` | `data/bios/saturn/` |
| NDS | `bios7.bin`, `bios9.bin`, `firmware.bin` | `data/bios/nds/` |
| GBA | `gba_bios.bin` | `data/bios/gba/` |

---

## ⚙️ Configuration

### Environment Variables

Edit `.env` to configure:

```env
# Database password (auto-generated)
DB_PASSWORD=your_secure_password

# JWT secret (auto-generated)
JWT_SECRET=your_jwt_secret

# Admin credentials
ADMIN_EMAIL=admin@romulus.local
ADMIN_PASSWORD=admin123

# Ports
HTTP_PORT=80
HTTPS_PORT=443
```

### Custom Ports

To run on different ports:

```env
HTTP_PORT=8080
HTTPS_PORT=8443
```

Then restart: `./scripts/restart.sh`

---

## 🔒 HTTPS Setup

### Using Let's Encrypt

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./nginx/ssl/key.pem

# Edit nginx/nginx.conf to enable HTTPS server block
# Restart
./scripts/restart.sh frontend
```

---

## 🐳 Docker Commands

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f backend

# Restart a service
docker compose restart backend

# Rebuild images
docker compose build --no-cache

# Stop everything
docker compose down

# Stop and remove volumes (WARNING: deletes database!)
docker compose down -v
```

---

## 🔍 Troubleshooting

### Services won't start

```bash
# Check status
./scripts/status.sh

# View logs
./scripts/logs.sh --errors

# Rebuild and restart
./scripts/restart.sh --rebuild
```

### Can't access web interface

```bash
# Check if containers are running
docker compose ps

# Check port 80
sudo lsof -i :80

# View nginx logs
./scripts/logs.sh frontend
```

### Database errors

```bash
# Check postgres logs
./scripts/logs.sh postgres

# Restart database
docker compose restart postgres
```

### Reset everything

```bash
# WARNING: This deletes all data!
./scripts/stop.sh --volumes --force
./scripts/install.sh
```

---

## 💾 Backup & Restore

### Create Backup

```bash
# Backup (excluding ROMs)
./scripts/backup.sh

# Backup including ROMs
./scripts/backup.sh --include-roms
```

### Restore Backup

```bash
./scripts/restore.sh backups/romulus-backup-20241201-120000.tar.gz
```

---

## 📋 System Requirements

| | Minimum | Recommended |
|---|---------|-------------|
| **CPU** | 4 cores | 8+ cores |
| **RAM** | 4 GB | 16+ GB |
| **Storage** | 50 GB | 500+ GB |
| **Network** | 10 Mbps | 100+ Mbps |
| **Docker** | 20.10+ | Latest |

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- [RetroArch](https://www.retroarch.com/) - Emulation frontend
- [EmulatorJS](https://emulatorjs.org/) - Web emulation
- [RetroAchievements](https://retroachievements.org/) - Achievement system

---

<p align="center">
  Made with ❤️ for retro gaming enthusiasts
</p>
