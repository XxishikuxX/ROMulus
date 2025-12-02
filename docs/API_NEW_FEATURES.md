# ROMulus API Documentation - New Features v2.0

## 🏆 RetroAchievements API (`/api/retroachievements`)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/link` | Link RA account with username/apiKey |
| `POST` | `/unlink` | Unlink RA account |
| `GET` | `/profile` | Get linked RA profile |
| `GET` | `/game/:gameId` | Get achievements for a game |
| `POST` | `/hash` | Calculate ROM hash for game lookup |
| `POST` | `/award` | Award achievement (emulator callback) |
| `GET` | `/completed` | Get user's completed games |
| `GET` | `/leaderboards/:gameId` | Get game leaderboards |
| `GET` | `/lookup/:hash` | Look up game by ROM hash |

---

## ☁️ Cloud Save API (`/api/cloudsave`)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/manifest` | Get save file manifest |
| `POST` | `/upload` | Upload save/state file |
| `GET` | `/download/:path` | Download save file |
| `POST` | `/sync` | Sync saves (with conflict detection) |
| `GET` | `/saves/:gameId` | List saves for a game |
| `GET` | `/versions/:path` | Get version history |
| `POST` | `/restore/:versionId` | Restore from version |
| `DELETE` | `/:path` | Delete save file |
| `PROPFIND` | `/webdav/*` | WebDAV compatibility |

---

## 📊 ROM Scraper API (`/api/scraper`)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scrape/:romId` | Scrape single ROM metadata |
| `POST` | `/batch` | Batch scrape ROMs |
| `GET` | `/search` | Search for game metadata |
| `POST` | `/apply` | Apply search result to ROM |
| `GET` | `/status` | Get scraping status/stats |
| `GET` | `/sources` | List available scraping sources |

### Scraping Sources
- **ScreenScraper** - Hash-based, most accurate (requires API key)
- **TheGamesDB** - Name-based search
- **LaunchBox** - Free, no key required

---

## 📺 Shaders API (`/api/shaders`)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/presets` | List all shader presets |
| `GET` | `/presets/:id` | Get preset details |
| `GET` | `/recommendations/:system` | Get recommended shaders |
| `GET` | `/user-configs` | Get user's saved configs |
| `POST` | `/user-configs` | Save shader configuration |
| `PUT` | `/user-configs/:id` | Update configuration |
| `DELETE` | `/user-configs/:id` | Delete configuration |
| `POST` | `/default/:system` | Set default for system |
| `GET` | `/generate-slangp/:configId` | Generate .slangp file |

### Shader Categories
- `crt` - CRT displays (Royale, Geom, Lottes, EasyMode, Guest-Venom)
- `ntsc` - NTSC video simulation
- `lcd` - Handheld LCD simulation
- `upscale` - Pixel art upscaling (xBRZ, HQx, ScaleFX)
- `clean` - Sharp/clean filters
- `special` - Special effects (Mega Bezel)

---

## ⚡ Emulator Settings API (`/api/emulator-settings`)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/global` | Get global settings |
| `PUT` | `/global` | Update global settings |
| `GET` | `/system/:system` | Get system-specific settings |
| `PUT` | `/system/:system` | Update system settings |
| `DELETE` | `/system/:system` | Reset to defaults |
| `GET` | `/presets/input-lag` | Get input lag presets |
| `POST` | `/presets/input-lag/:id` | Apply preset |
| `GET` | `/defaults` | Get all defaults |
| `GET` | `/export` | Export settings |
| `POST` | `/import` | Import settings |

### Settings Categories
- **Run-Ahead**: `enabled`, `frames`, `useSecondInstance`
- **Rewind**: `enabled`, `bufferSize`, `granularity`
- **Fast Forward**: `speed`, `frameSkip`, `holdToActivate`
- **Slow Motion**: `speed`, `holdToActivate`
- **Video**: `vsync`, `hardGpuSync`, `frameDelay`, `aspectRatio`, `integerScale`
- **Audio**: `enabled`, `latency`, `volume`, `rateControl`

---

## 🎮 Netplay API (`/api/netplay`)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/compatibility/:system` | Get system netplay support |
| `POST` | `/sessions` | Create netplay session |
| `GET` | `/sessions` | List available sessions |
| `GET` | `/sessions/:id` | Get session details |
| `POST` | `/sessions/:id/join` | Join session |
| `POST` | `/sessions/:id/leave` | Leave session |
| `POST` | `/sessions/:id/ready` | Set ready status |
| `POST` | `/sessions/:id/start` | Start game (host only) |
| `POST` | `/sessions/:id/ping` | Report latency |
| `POST` | `/sessions/:id/end` | End session |
| `GET` | `/relay-servers` | Get relay server list |

### Netplay Modes
- `ggpo` - GGPO-style rollback netcode
- `lockstep` - Traditional lockstep
- `spectate` - Spectator only

---

## 🎯 Cheats API (`/api/cheats`)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/game/:gameId` | Get cheats for a game |
| `GET` | `/search` | Search cheats |
| `GET` | `/favorites` | Get user's favorites |
| `POST` | `/favorites/:cheatId` | Add to favorites |
| `DELETE` | `/favorites/:cheatId` | Remove from favorites |
| `GET` | `/custom` | Get user's custom cheats |
| `POST` | `/custom` | Create custom cheat |
| `PUT` | `/custom/:id` | Update custom cheat |
| `DELETE` | `/custom/:id` | Delete custom cheat |
| `GET` | `/formats/:system` | Get supported formats |
| `GET` | `/categories/:system` | Get cheat categories |
| `POST` | `/convert` | Convert cheat format |
| `POST` | `/import` | Import cheats (admin) |
| `GET` | `/export/:gameId` | Export cheats (JSON/.cht) |

### Cheat Formats
- NES: Game Genie, Pro Action Replay, Raw
- SNES: Game Genie, Pro Action Replay, Raw
- N64: GameShark, Raw
- GB/GBC: Game Genie, GameShark, Raw
- GBA: GameShark, Action Replay, CodeBreaker, Raw
- Genesis: Game Genie, Pro Action Replay, Raw
- PS1: GameShark, Raw
- PS2: CodeBreaker, Action Replay MAX, Raw
- PSP: CWCheat, Raw

---

## Database Schema Additions

### New Models

```prisma
model UserRAchievement {
  id            String   @id
  userId        String
  achievementId String
  hardcore      Boolean
  earnedAt      DateTime
}

model CloudSave {
  id           String
  userId       String
  relativePath String
  type         String  // 'save' or 'state'
  hash         String
  size         Int
  modifiedAt   DateTime
  gameId       String?
  system       String?
  slot         Int?
}

model CloudSaveVersion {
  id          String
  cloudSaveId String
  hash        String
  size        Int
  data        Bytes?
  createdAt   DateTime
}

model SyncEvent {
  id              String
  userId          String
  deviceId        String
  filesUploaded   Int
  filesDownloaded Int
  conflicts       Int
}

model UserShaderConfig {
  id        String
  userId    String
  name      String
  presetId  String
  system    String?
  settings  Json
  isDefault Boolean
}

model UserEmulatorSettings {
  id       String
  userId   String
  system   String  // 'global' or specific
  settings Json
}

model NetplaySession {
  id         String
  hostId     String
  romId      String
  mode       String
  maxPlayers Int
  settings   Json
  status     String
}

model CheatCode {
  id          String
  romId       String?
  gameTitle   String
  system      String
  name        String
  description String?
  code        String
  format      String
  category    String?
  isCustom    Boolean
  isVerified  Boolean
  createdBy   String?
}

model UserFavoriteCheat {
  id      String
  userId  String
  cheatId String
  addedAt DateTime
}
```

---

## Environment Variables

```bash
# RetroAchievements (optional)
RA_API_KEY=your_ra_api_key

# Scraping (optional but recommended)
SCREENSCRAPER_DEV_ID=your_dev_id
SCREENSCRAPER_DEV_PASSWORD=your_dev_password
THEGAMESDB_API_KEY=your_api_key

# Paths
SAVES_PATH=/opt/romulus/data/saves
STATES_PATH=/opt/romulus/data/states
COVERS_PATH=/opt/romulus/data/covers
SCREENSHOTS_PATH=/opt/romulus/data/screenshots
SHADERS_PATH=/opt/romulus/data/shaders
```
