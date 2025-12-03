# 👑 ROMulus

<div align="center">
  <img src="frontend/public/logo.png" alt="ROMulus Logo" width="200" />
  
  **A Self-Hosted Multi-Emulation Platform with Remote Play**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Ubuntu 24.04](https://img.shields.io/badge/Ubuntu-24.04%20LTS-orange.svg)](https://ubuntu.com/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
  [![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
  
  [Features](#-features) • [Quick Start](#-quick-start) • [Installation](#-installation) • [Management](#-management-scripts) • [Mobile App](#-mobile-app) • [Troubleshooting](#-troubleshooting)
</div>

---

## 📖 What is ROMulus?

ROMulus is a web-based retro gaming platform that lets you:
- 🎮 Play classic games from 15+ consoles in your browser
- 📱 Stream games to your phone, tablet, or handheld device
- 👥 Play multiplayer games with friends online
- 🏆 Earn achievements via RetroAchievements integration
- ☁️ Sync saves across all your devices

---

## 🎮 Supported Systems

| Nintendo | Sony | Sega | Other |
|----------|------|------|-------|
| NES | PlayStation 1 | Genesis/Mega Drive | Arcade (MAME) |
| SNES | PlayStation 2 | Saturn | Neo Geo |
| N64 | PlayStation 3 | Dreamcast | TurboGrafx-16 |
| GameCube | PSP | Master System | Atari |
| Wii / Wii U | PS Vita | Game Gear | |
| Game Boy / Color / Advance | | Sega CD / 32X | |
| DS / DSi / 3DS | | | |

---

## ✨ Features

- 🌐 **Web Interface** - Play directly in your browser, no installation needed
- 📱 **Remote Play** - Stream to Android, iOS, Steam Deck, ROG Ally, Anbernic
- 👥 **Multiplayer** - Online co-op and versus with rollback netcode
- 🏆 **Achievements** - RetroAchievements.org integration
- ☁️ **Cloud Saves** - Automatic save synchronization
- 🎨 **CRT Shaders** - Authentic retro visuals
- 📊 **Statistics** - Track playtime and gaming history
- 👨‍💼 **Admin Panel** - Manage users, ROMs, and settings
- 🔒 **User Accounts** - Personal libraries and settings

---

## 🚀 Quick Start

### For Experienced Users (One Command)

```bash
git clone https://github.com/XxishikuxX/ROMulus.git /opt/romulus && cd /opt/romulus && chmod +x *.sh scripts/*.sh && sudo ./install.sh && ./start.sh
```

### For Beginners (Step by Step)

Continue reading the [Full Installation Guide](#-installation) below.

---

## 📋 Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| **CPU** | 4 cores | 8+ cores |
| **RAM** | 8 GB | 16+ GB |
| **Storage** | 50 GB | 200+ GB (for ROMs) |
| **Network** | 10 Mbps | 100+ Mbps |

---

## 📥 Installation

### Step 1: Get a Fresh Ubuntu Server

If you don't have Ubuntu 24.04 LTS installed:

**Option A: Local Server**
1. Download Ubuntu Server 24.04 LTS from [ubuntu.com](https://ubuntu.com/download/server)
2. Install on your PC or server

**Option B: Cloud Server (Linode, DigitalOcean, AWS, etc.)**
1. Create a new server with Ubuntu 24.04 LTS
2. Note your server's IP address
3. SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

---

### Step 2: Download ROMulus

**Option A: Using Git (Recommended)**
```bash
# Install git if not present
sudo apt update && sudo apt install git -y

# Clone ROMulus
git clone https://github.com/XxishikuxX/ROMulus.git /opt/romulus
cd /opt/romulus
```

**Option B: Using SSH Key (For Private Repos)**
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Display key (add this to GitHub → Settings → SSH Keys)
cat ~/.ssh/id_ed25519.pub

# Clone via SSH
git clone git@github.com:XxishikuxX/ROMulus.git /opt/romulus
cd /opt/romulus
```

**Option C: Download ZIP**
```bash
# Download and extract
wget https://github.com/XxishikuxX/ROMulus/archive/main.zip
unzip main.zip
mv ROMulus-main /opt/romulus
cd /opt/romulus
```

---

### Step 3: Make Scripts Executable

```bash
chmod +x *.sh scripts/*.sh
```

---

### Step 4: Run the Installer

```bash
sudo ./install.sh
```

The installer will automatically:
- ✅ Update your system
- ✅ Install Docker and Docker Compose
- ✅ Install Node.js 20+
- ✅ Create directory structure for ROMs and BIOS
- ✅ Configure the database
- ✅ Set up Nginx reverse proxy
- ✅ Generate secure passwords
- ✅ Start all services

**Installation takes 5-15 minutes** depending on your internet speed.

---

### Step 5: Start ROMulus

```bash
./start.sh
```

You'll see:
```
    ____  ____  __  ___      __           
   / __ \/ __ \/  |/  /_  __/ /_  _______
  / /_/ / / / / /|_/ / / / / / / / / ___/
 / _, _/ /_/ / /  / / /_/ / / /_/ (__  ) 
/_/ |_|\____/_/  /_/\__,_/_/\__,_/____/  

        👑 Web-Based Emulator 👑

════════════════════════════════════════════
  ✅ ROMulus Started Successfully!
════════════════════════════════════════════

🌐 Access URLs:
   Local:   http://localhost
   Network: http://192.168.1.100

🔑 Default Credentials:
   Email:    admin@romulus.local
   Password: admin123
```

---

### Step 6: Access ROMulus

Open your browser and go to:

| Access Type | URL |
|-------------|-----|
| **Same Machine** | http://localhost |
| **Local Network** | http://YOUR_SERVER_IP |
| **Remote Server** | http://YOUR_PUBLIC_IP |

**Default Login:**
- 📧 Email: `admin@romulus.local`
- 🔑 Password: `admin123`

⚠️ **Change the default password immediately after first login!**

---

## 🛠 Management Scripts

ROMulus includes easy-to-use management scripts:

| Script | Description | Usage |
|--------|-------------|-------|
| `start.sh` | Start all services | `./start.sh` |
| `stop.sh` | Stop all services | `./stop.sh` |
| `restart.sh` | Restart all services | `./restart.sh` |
| `status.sh` | View system status | `./status.sh` |
| `logs.sh` | View service logs | `./logs.sh` |
| `update.sh` | Update ROMulus | `./update.sh` |
| `install.sh` | Initial installation | `sudo ./install.sh` |

---

### 🟢 Starting ROMulus

```bash
cd /opt/romulus
./start.sh
```

**Options:**
```bash
./start.sh           # Normal start
./start.sh -f        # Force restart
./start.sh -q        # Quiet mode (less output)
./start.sh -h        # Show help
```

---

### 🔴 Stopping ROMulus

```bash
./stop.sh
```

**Options:**
```bash
./stop.sh            # Graceful stop
./stop.sh -f         # Force kill (if stuck)
./stop.sh -c         # Stop and clean Docker volumes
./stop.sh -q         # Quiet mode
```

---

### 🔄 Restarting ROMulus

```bash
./restart.sh
```

**Options:**
```bash
./restart.sh         # Normal restart
./restart.sh -f      # Force restart
./restart.sh --pull  # Pull latest Docker images first
```

---

### 📊 Checking Status

```bash
./status.sh
```

**Shows:**
- Container status (running/stopped)
- Health checks for all services
- CPU and memory usage
- Disk usage for ROMs, saves, etc.
- ROM library count by system
- Network URLs

**Example Output:**
```
═══════════════════════════════════════════════════════════
  📊 Container Status
═══════════════════════════════════════════════════════════

  ● ROMulus is RUNNING

NAME                STATUS          PORTS
romulus-frontend    Up 2 hours      0.0.0.0:80->80/tcp
romulus-backend     Up 2 hours      0.0.0.0:3000->3000/tcp
romulus-db          Up 2 hours      5432/tcp
romulus-redis       Up 2 hours      6379/tcp

═══════════════════════════════════════════════════════════
  🎮 ROM Library
═══════════════════════════════════════════════════════════

  NES:         142 ROMs
  SNES:        89 ROMs
  N64:         45 ROMs
  PlayStation: 67 ROMs
  
  Total: 343 ROMs
```

---

### 📋 Viewing Logs

```bash
./logs.sh
```

**Options:**
```bash
./logs.sh                    # All logs (last 100 lines)
./logs.sh backend            # Backend API logs only
./logs.sh frontend           # Frontend/Nginx logs only
./logs.sh db                 # Database logs only
./logs.sh redis              # Redis cache logs only
./logs.sh streaming          # Streaming server logs only

./logs.sh -f                 # Follow logs in real-time
./logs.sh backend -f         # Follow backend logs
./logs.sh -n 500             # Show last 500 lines
./logs.sh --since 1h         # Logs from last hour
./logs.sh --since 30m        # Logs from last 30 minutes
./logs.sh --errors           # Show only errors
```

**Examples:**
```bash
# Debug backend issues
./logs.sh backend -f

# Check for errors in the last hour
./logs.sh --since 1h --errors

# Monitor everything in real-time
./logs.sh -f
```

---

### ⬆️ Updating ROMulus

```bash
./update.sh
```

**Options:**
```bash
./update.sh          # Interactive update
./update.sh -c       # Check for updates only (don't install)
./update.sh -y       # Auto-confirm (no prompts)
./update.sh --rollback  # Rollback to previous version
```

**Update Process:**
1. Checks for new version
2. Creates backup of current installation
3. Downloads latest code
4. Updates Docker images
5. Runs database migrations
6. Restarts services

---

## 📁 Directory Structure

After installation, your files are organized as:

```
/opt/romulus/
├── data/
│   ├── roms/           # Your ROM files
│   │   ├── nes/
│   │   ├── snes/
│   │   ├── n64/
│   │   ├── gb/
│   │   ├── gbc/
│   │   ├── gba/
│   │   ├── nds/
│   │   ├── gamecube/
│   │   ├── wii/
│   │   ├── ps1/
│   │   ├── ps2/
│   │   ├── psp/
│   │   ├── genesis/
│   │   ├── dreamcast/
│   │   └── arcade/
│   ├── bios/           # System BIOS files
│   │   ├── ps1/
│   │   ├── ps2/
│   │   └── ...
│   ├── saves/          # Game saves
│   ├── states/         # Save states
│   ├── covers/         # Box art images
│   └── screenshots/    # Your screenshots
├── logs/               # Application logs
├── backend/            # API server code
├── frontend/           # Web interface code
├── mobile/             # Mobile app code
├── start.sh            # Start script
├── stop.sh             # Stop script
├── restart.sh          # Restart script
├── status.sh           # Status script
├── logs.sh             # Log viewer script
├── update.sh           # Update script
└── docker-compose.yml  # Docker configuration
```

---

## 🎮 Adding ROMs

### Method 1: Web Upload (Easiest)

1. Log in to ROMulus
2. Go to **Library** → **Upload**
3. Drag and drop your ROM files
4. ROMs are automatically sorted by system

### Method 2: Direct File Transfer

```bash
# Copy ROMs to the appropriate folder
cp ~/my-snes-roms/*.sfc /opt/romulus/data/roms/snes/
cp ~/my-ps1-games/*.bin /opt/romulus/data/roms/ps1/

# Set permissions
sudo chown -R 1000:1000 /opt/romulus/data/roms/
```

### Method 3: SFTP/SCP

```bash
# From your local machine
scp -r ./my-roms/* user@YOUR_SERVER_IP:/opt/romulus/data/roms/
```

---

## 🔧 Adding BIOS Files

Some systems require BIOS files to run. Place them in `/opt/romulus/data/bios/`:

| System | Required BIOS | Folder |
|--------|--------------|--------|
| PS1 | `scph1001.bin` | `/opt/romulus/data/bios/ps1/` |
| PS2 | `bios.bin` | `/opt/romulus/data/bios/ps2/` |
| Saturn | `saturn_bios.bin` | `/opt/romulus/data/bios/saturn/` |
| Dreamcast | `dc_boot.bin` | `/opt/romulus/data/bios/dreamcast/` |
| NDS | `bios7.bin`, `bios9.bin`, `firmware.bin` | `/opt/romulus/data/bios/nds/` |

---

## 📱 Mobile App

ROMulus includes a mobile app for remote play on:

- 📱 Android phones and tablets
- 🎮 Anbernic handhelds (RG405M, RG505, RG556)
- 🎮 Retroid Pocket (3+, 4, Mini)
- 🎮 AYANEO devices
- 🎮 Steam Deck
- 🎮 ASUS ROG Ally
- 📱 iOS/iPad

### Building the Android App

```bash
cd /opt/romulus/mobile
npm install
./build-apk.sh standard    # For phones/tablets
./build-apk.sh anbernic    # For Anbernic devices
./build-apk.sh all         # Build all variants
```

See [mobile/README.md](mobile/README.md) for detailed instructions.

---

## 🌐 Remote Access Setup

### 🔥 Firewall Ports (UFW)

ROMulus requires the following ports to be open:

| Port | Protocol | Service | Required | Description |
|------|----------|---------|----------|-------------|
| **80** | TCP | HTTP | ✅ Yes | Main web interface |
| **443** | TCP | HTTPS | ⚡ Recommended | Secure web access (SSL) |
| **3000** | TCP | API | ✅ Yes | Backend API server |
| **8080** | TCP | Streaming | ✅ Yes | Game streaming (WebRTC) |
| **3478** | UDP | STUN | 🎮 For Multiplayer | NAT traversal |
| **5349** | TCP | TURN | 🎮 For Multiplayer | Relay server |
| **10000-10100** | UDP | WebRTC | 🎮 For Multiplayer | Media streams |

---

### Quick UFW Setup (Copy & Paste)

```bash
# Enable UFW if not already enabled
sudo ufw enable

# Required ports - MUST OPEN
sudo ufw allow 80/tcp comment 'ROMulus Web Interface'
sudo ufw allow 443/tcp comment 'ROMulus HTTPS'
sudo ufw allow 3000/tcp comment 'ROMulus API'
sudo ufw allow 8080/tcp comment 'ROMulus Streaming'

# Optional - For multiplayer/netplay
sudo ufw allow 3478/udp comment 'ROMulus STUN'
sudo ufw allow 5349/tcp comment 'ROMulus TURN'
sudo ufw allow 10000:10100/udp comment 'ROMulus WebRTC Media'

# Allow SSH (so you don't lock yourself out!)
sudo ufw allow 22/tcp comment 'SSH Access'

# Check status
sudo ufw status verbose
```

---

### UFW Status Check

```bash
sudo ufw status numbered
```

**Expected Output:**
```
Status: active

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere        # SSH Access
[ 2] 80/tcp                     ALLOW IN    Anywhere        # ROMulus Web Interface
[ 3] 443/tcp                    ALLOW IN    Anywhere        # ROMulus HTTPS
[ 4] 3000/tcp                   ALLOW IN    Anywhere        # ROMulus API
[ 5] 8080/tcp                   ALLOW IN    Anywhere        # ROMulus Streaming
[ 6] 3478/udp                   ALLOW IN    Anywhere        # ROMulus STUN
[ 7] 5349/tcp                   ALLOW IN    Anywhere        # ROMulus TURN
[ 8] 10000:10100/udp            ALLOW IN    Anywhere        # ROMulus WebRTC Media
```

---

### Cloud Provider Firewalls

If using a cloud provider, you also need to open ports in their firewall:

**Linode:**
1. Go to Linode Cloud Manager → Your Linode → Network → Firewalls
2. Add inbound rules for ports 80, 443, 3000, 8080

**DigitalOcean:**
1. Go to Networking → Firewalls
2. Create/edit firewall with inbound rules for required ports

**AWS:**
1. Go to EC2 → Security Groups
2. Edit inbound rules to allow required ports

**Google Cloud:**
1. Go to VPC Network → Firewall rules
2. Create rules allowing required ports

---

### Verify Ports Are Open

From your **local machine** (not the server):

```bash
# Test if ports are accessible
nc -zv YOUR_SERVER_IP 80
nc -zv YOUR_SERVER_IP 3000
nc -zv YOUR_SERVER_IP 8080

# Or use curl
curl -I http://YOUR_SERVER_IP
curl http://YOUR_SERVER_IP:3000/health
```

---

### Setting Up a Domain (Optional)

1. Point your domain to your server's IP (A record)
2. Install SSL certificate:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

3. Access via `https://yourdomain.com`

---

## ❓ Troubleshooting

### ROMulus won't start

```bash
# Check status
./status.sh

# Check logs for errors
./logs.sh --errors

# Try restarting
./restart.sh -f
```

### Can't access web interface

```bash
# Check if services are running
docker ps

# Check what's using port 80
sudo lsof -i :80

# If system nginx is blocking, disable it
sudo systemctl stop nginx
sudo systemctl disable nginx
./restart.sh
```

### Games won't load

1. Check if BIOS files are needed for that system
2. Verify ROM file isn't corrupted
3. Check logs: `./logs.sh backend -f`

### Database errors

```bash
# Reset database (WARNING: loses all data)
./stop.sh
docker volume rm romulus_postgres_data
./start.sh
```

### Out of disk space

```bash
# Check disk usage
./status.sh

# Clean Docker cache
docker system prune -a
```

---

## 🔒 Security Recommendations

1. **Change default password** immediately after installation
2. **Use HTTPS** with Let's Encrypt for remote access
3. **Set up a firewall** - only open necessary ports
4. **Regular updates** - run `./update.sh` periodically
5. **Backup your data** - especially saves and configurations

---

## 📞 Support

- 📖 [Documentation](https://github.com/XxishikuxX/ROMulus/wiki)
- 🐛 [Report Issues](https://github.com/XxishikuxX/ROMulus/issues)
- 💬 [Discussions](https://github.com/XxishikuxX/ROMulus/discussions)

---

## 📜 License

ROMulus is open source under the [MIT License](LICENSE).

**Note:** ROMulus does not include any copyrighted game ROMs or BIOS files. You must provide your own legally obtained files.

---

## 🙏 Credits

- [RetroArch](https://www.retroarch.com/) - Emulation cores
- [EmulatorJS](https://emulatorjs.org/) - Browser emulation
- [RetroAchievements](https://retroachievements.org/) - Achievement system

---

<div align="center">
  <b>Made with ❤️ for retro gaming enthusiasts</b>
  <br><br>
  <a href="#-romulus">⬆️ Back to Top</a>
</div>
