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

## 🚀 Quick Start (One Command!)

```bash
git clone https://github.com/YOUR_USERNAME/ROMulus.git
cd ROMulus
docker compose up -d
```

**That's it!** Access ROMulus at `http://localhost`

### Default Login
- **Email:** `admin@romulus.local`
- **Password:** `admin123`

⚠️ **Change the default password immediately!**

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

## 📋 Requirements

- **Docker** with Docker Compose
- **4GB+ RAM** recommended
- **Storage** for your ROM collection

### Install Docker (if needed)

```bash
curl -fsSL https://get.docker.com | sh
```

---

## 🎮 Adding ROMs

### Option 1: Copy to Docker Volume

```bash
# Find the volume location
docker volume inspect romulus_roms_data

# Copy ROMs (example)
sudo cp game.nes /var/lib/docker/volumes/romulus_roms_data/_data/nes/
sudo cp game.sfc /var/lib/docker/volumes/romulus_roms_data/_data/snes/
```

### Option 2: Use Web Upload
1. Log in to ROMulus
2. Go to **Library** → **Upload**
3. Select ROMs to upload

### Option 3: Mount Local Directory

Edit `docker-compose.yml` to use bind mounts instead of volumes:

```yaml
volumes:
  - ./my-roms:/data/roms
```

---

## ⚙️ Configuration

### Custom Settings

Create a `.env` file:

```env
# Change default port
HTTP_PORT=8080

# Custom admin credentials
ADMIN_EMAIL=me@example.com
ADMIN_PASSWORD=mysecurepassword

# Database password (optional, auto-generated)
DB_PASSWORD=my_database_password

# JWT secret (optional, has default)
JWT_SECRET=my_64_character_secret_key_here_make_it_long_and_random_please
```

Then restart:
```bash
docker compose down
docker compose up -d
```

---

## 🔧 BIOS Files

Some systems require BIOS files. Copy them to the bios volume:

```bash
# PS1
docker cp scph1001.bin romulus-backend:/data/bios/ps1/

# Or find volume and copy directly
docker volume inspect romulus_bios_data
```

| System | Required Files |
|--------|---------------|
| PS1 | `scph1001.bin` |
| PS2 | `bios.bin` |
| Dreamcast | `dc_boot.bin`, `dc_flash.bin` |
| Saturn | `saturn_bios.bin` |
| NDS | `bios7.bin`, `bios9.bin`, `firmware.bin` |
| GBA | `gba_bios.bin` |

---

## 🛠 Management Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Restart
docker compose restart

# Rebuild after updates
docker compose build --no-cache
docker compose up -d

# Check status
docker compose ps

# Shell into container
docker exec -it romulus-backend sh
```

---

## 💾 Backup & Restore

### Backup Database
```bash
docker exec romulus-db pg_dump -U romulus romulus > backup.sql
```

### Restore Database
```bash
docker exec -i romulus-db psql -U romulus romulus < backup.sql
```

### Backup Saves
```bash
docker cp romulus-backend:/data/saves ./saves-backup
```

---

## 🔍 Troubleshooting

### Container won't start
```bash
docker compose logs backend
```

### Database errors
```bash
docker compose logs postgres
docker compose restart postgres
```

### Reset everything
```bash
docker compose down -v  # WARNING: Deletes all data!
docker compose up -d
```

### Check health
```bash
curl http://localhost/api/health
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐           │
│  │  Nginx   │──▶│ Backend  │◀──│Streaming │           │
│  │  :80     │   │  :3000   │   │  :8080   │           │
│  └──────────┘   └────┬─────┘   └──────────┘           │
│                      │                                 │
│         ┌────────────┴────────────┐                   │
│         ▼                         ▼                   │
│  ┌──────────────┐        ┌──────────────┐            │
│  │  PostgreSQL  │        │    Redis     │            │
│  │    :5432     │        │    :6379     │            │
│  └──────────────┘        └──────────────┘            │
└─────────────────────────────────────────────────────────┘
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

<p align="center">
  Made with ❤️ for retro gaming enthusiasts
</p>
