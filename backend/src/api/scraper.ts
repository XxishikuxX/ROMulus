import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

// Scraping sources
const SCRAPER_SOURCES = {
  SCREENSCRAPER: 'https://www.screenscraper.fr/api2',
  THEGAMESDB: 'https://api.thegamesdb.net/v1',
  IGDB: 'https://api.igdb.com/v4',
  LAUNCHBOX: 'https://gamesdb.launchbox-app.com',
};

// System ID mappings for different scrapers
const SYSTEM_MAPPINGS = {
  screenscraper: {
    NES: 3, SNES: 4, N64: 14, GB: 9, GBC: 10, GBA: 12,
    GENESIS: 1, MASTER_SYSTEM: 2, GAME_GEAR: 21, DREAMCAST: 23,
    SATURN: 22, PS1: 57, PS2: 58, PSP: 61,
    GAMECUBE: 13, WII: 16, NDS: 15, ARCADE: 75,
  },
  thegamesdb: {
    NES: 7, SNES: 6, N64: 3, GB: 4, GBC: 41, GBA: 5,
    GENESIS: 18, MASTER_SYSTEM: 35, GAME_GEAR: 20, DREAMCAST: 16,
    SATURN: 17, PS1: 10, PS2: 11, PSP: 13,
    GAMECUBE: 2, WII: 9, NDS: 8, ARCADE: 23,
  },
};

interface ScrapedMetadata {
  title?: string;
  description?: string;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  genre?: string;
  players?: string;
  rating?: number;
  coverUrl?: string;
  screenshotUrls?: string[];
  videoUrl?: string;
  region?: string;
}

// Calculate ROM hash for identification
async function calculateRomHash(filePath: string): Promise<{ md5: string; sha1: string; crc32: string }> {
  const content = await fs.readFile(filePath);
  
  // Skip headers for certain formats
  let data = content;
  const ext = path.extname(filePath).toLowerCase();
  
  // Skip iNES header for NES
  if (ext === '.nes' && content[0] === 0x4E && content[1] === 0x45) {
    data = content.slice(16);
  }
  // Skip SMC header for SNES
  if ((ext === '.smc' || ext === '.sfc') && content.length % 1024 === 512) {
    data = content.slice(512);
  }

  return {
    md5: crypto.createHash('md5').update(data).digest('hex'),
    sha1: crypto.createHash('sha1').update(data).digest('hex'),
    crc32: calculateCRC32(data),
  };
}

// CRC32 calculation
function calculateCRC32(data: Buffer): string {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

// ScreenScraper API
async function scrapeScreenScraper(
  hash: { md5: string; sha1: string; crc32: string },
  system: string,
  filename: string
): Promise<ScrapedMetadata | null> {
  const devId = process.env.SCREENSCRAPER_DEV_ID;
  const devPassword = process.env.SCREENSCRAPER_DEV_PASSWORD;
  const softname = 'ROMulus';

  if (!devId || !devPassword) {
    console.warn('ScreenScraper credentials not configured');
    return null;
  }

  const systemId = SYSTEM_MAPPINGS.screenscraper[system as keyof typeof SYSTEM_MAPPINGS.screenscraper];
  if (!systemId) return null;

  try {
    const params = new URLSearchParams({
      devid: devId,
      devpassword: devPassword,
      softname,
      output: 'json',
      md5: hash.md5,
      sha1: hash.sha1,
      crc: hash.crc32,
      systemeid: systemId.toString(),
      romnom: filename,
    });

    const response = await fetch(`${SCRAPER_SOURCES.SCREENSCRAPER}/jeuInfos.php?${params}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const game = data.response?.jeu;
    
    if (!game) return null;

    // Get localized text (prefer English, fallback to first available)
    const getText = (arr: any[], lang = 'en') => {
      if (!arr) return undefined;
      const item = arr.find((t: any) => t.langue === lang) || arr[0];
      return item?.text;
    };

    return {
      title: getText(game.noms, 'en') || game.nom,
      description: getText(game.synopsis, 'en'),
      developer: game.developpeur?.text,
      publisher: game.editeur?.text,
      releaseDate: game.dates?.find((d: any) => d.region === 'us')?.text || game.dates?.[0]?.text,
      genre: game.genres?.map((g: any) => getText(g.noms, 'en')).join(', '),
      players: game.joueurs?.text,
      rating: game.note?.text ? parseFloat(game.note.text) / 20 * 10 : undefined, // Convert to 0-10
      coverUrl: game.medias?.find((m: any) => m.type === 'box-2D')?.url,
      screenshotUrls: game.medias
        ?.filter((m: any) => m.type === 'ss' || m.type === 'sstitle')
        ?.map((m: any) => m.url)
        ?.slice(0, 5),
      videoUrl: game.medias?.find((m: any) => m.type === 'video')?.url,
      region: game.regions?.[0]?.shortname,
    };
  } catch (error) {
    console.error('ScreenScraper error:', error);
    return null;
  }
}

// TheGamesDB API
async function scrapeTheGamesDB(
  gameName: string,
  system: string
): Promise<ScrapedMetadata | null> {
  const apiKey = process.env.THEGAMESDB_API_KEY;
  
  if (!apiKey) {
    console.warn('TheGamesDB API key not configured');
    return null;
  }

  const platformId = SYSTEM_MAPPINGS.thegamesdb[system as keyof typeof SYSTEM_MAPPINGS.thegamesdb];
  if (!platformId) return null;

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      name: gameName,
      'filter[platform]': platformId.toString(),
      include: 'boxart,platform',
    });

    const response = await fetch(`${SCRAPER_SOURCES.THEGAMESDB}/Games/ByGameName?${params}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const game = data.data?.games?.[0];
    
    if (!game) return null;

    const boxart = data.include?.boxart?.data?.[game.id];
    const baseUrl = data.include?.boxart?.base_url?.original || '';

    return {
      title: game.game_title,
      description: game.overview,
      developer: data.include?.developers?.[game.developers?.[0]]?.name,
      publisher: data.include?.publishers?.[game.publishers?.[0]]?.name,
      releaseDate: game.release_date,
      genre: game.genres?.map((g: number) => data.include?.genres?.[g]?.name).filter(Boolean).join(', '),
      players: game.players?.toString(),
      rating: game.rating ? parseFloat(game.rating) : undefined,
      coverUrl: boxart?.find((b: any) => b.side === 'front')
        ? `${baseUrl}${boxart.find((b: any) => b.side === 'front').filename}`
        : undefined,
      screenshotUrls: data.include?.images?.data?.[game.id]
        ?.filter((i: any) => i.type === 'screenshot')
        ?.map((i: any) => `${data.include?.images?.base_url?.original}${i.filename}`)
        ?.slice(0, 5),
    };
  } catch (error) {
    console.error('TheGamesDB error:', error);
    return null;
  }
}

// LaunchBox Games Database (free, no API key needed)
async function scrapeLaunchBox(
  gameName: string,
  system: string
): Promise<ScrapedMetadata | null> {
  try {
    // LaunchBox has an open metadata endpoint
    const searchName = encodeURIComponent(gameName.replace(/[^\w\s]/g, ''));
    const response = await fetch(
      `${SCRAPER_SOURCES.LAUNCHBOX}/Metadata/Games/ByGameName?name=${searchName}`
    );
    
    if (!response.ok) return null;
    
    const games = await response.json();
    const game = games?.[0];
    
    if (!game) return null;

    return {
      title: game.Name,
      description: game.Overview,
      developer: game.Developer,
      publisher: game.Publisher,
      releaseDate: game.ReleaseDate,
      genre: game.Genres,
      players: game.MaxPlayers?.toString(),
      rating: game.CommunityRating,
      coverUrl: game.BoxArtUrl,
      screenshotUrls: game.ScreenshotUrls?.slice(0, 5),
      videoUrl: game.VideoUrl,
    };
  } catch (error) {
    console.error('LaunchBox error:', error);
    return null;
  }
}

// Main scraping function - tries multiple sources
async function scrapeGameMetadata(
  filePath: string,
  system: string,
  filename: string
): Promise<ScrapedMetadata | null> {
  // Calculate hashes
  const hashes = await calculateRomHash(filePath);
  
  // Extract clean game name from filename
  const cleanName = filename
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/\([^)]*\)/g, '') // Remove parenthetical info
    .replace(/\[[^\]]*\]/g, '') // Remove bracketed info
    .replace(/[_-]/g, ' ') // Replace separators
    .trim();

  // Try ScreenScraper first (most accurate with hash matching)
  let metadata = await scrapeScreenScraper(hashes, system, filename);
  
  // Fallback to TheGamesDB
  if (!metadata?.title) {
    metadata = await scrapeTheGamesDB(cleanName, system) || metadata;
  }
  
  // Fallback to LaunchBox
  if (!metadata?.title) {
    metadata = await scrapeLaunchBox(cleanName, system) || metadata;
  }

  return metadata;
}

// Download and save cover image
async function downloadCover(url: string, romId: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const filename = `${romId}${ext}`;
    const coverPath = path.join(process.env.COVERS_PATH || '/opt/romulus/data/covers', filename);

    await fs.writeFile(coverPath, buffer);
    return `/static/covers/${filename}`;
  } catch (error) {
    console.error('Cover download error:', error);
    return null;
  }
}

// Download screenshots
async function downloadScreenshots(urls: string[], romId: string): Promise<string[]> {
  const saved: string[] = [];
  const screenshotsDir = path.join(
    process.env.SCREENSHOTS_PATH || '/opt/romulus/data/screenshots',
    romId
  );

  await fs.mkdir(screenshotsDir, { recursive: true });

  for (let i = 0; i < urls.length; i++) {
    try {
      const response = await fetch(urls[i]);
      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = path.extname(new URL(urls[i]).pathname) || '.jpg';
      const filename = `screenshot_${i + 1}${ext}`;
      const screenshotPath = path.join(screenshotsDir, filename);

      await fs.writeFile(screenshotPath, buffer);
      saved.push(`/static/screenshots/${romId}/${filename}`);
    } catch (error) {
      console.error(`Screenshot ${i} download error:`, error);
    }
  }

  return saved;
}

// Scrape single ROM
router.post('/scrape/:romId', authMiddleware, async (req: any, res) => {
  try {
    const { romId } = req.params;
    const { force = false } = req.body;

    const rom = await prisma.rom.findUnique({ where: { id: romId } });
    
    if (!rom) {
      return res.status(404).json({ error: 'ROM not found' });
    }

    // Check if already scraped (unless forced)
    if (!force && rom.description && rom.coverArt) {
      return res.json({ 
        status: 'already_scraped',
        rom,
      });
    }

    // Scrape metadata
    const metadata = await scrapeGameMetadata(rom.filepath, rom.system, rom.filename);

    if (!metadata) {
      return res.json({ 
        status: 'not_found',
        message: 'No metadata found for this ROM',
      });
    }

    // Download cover
    let coverPath = rom.coverArt;
    if (metadata.coverUrl && (!coverPath || force)) {
      coverPath = await downloadCover(metadata.coverUrl, romId) || coverPath;
    }

    // Download screenshots
    let screenshots: string[] = [];
    if (metadata.screenshotUrls?.length) {
      screenshots = await downloadScreenshots(metadata.screenshotUrls, romId);
    }

    // Update ROM with scraped data
    const updatedRom = await prisma.rom.update({
      where: { id: romId },
      data: {
        title: metadata.title || rom.title,
        description: metadata.description || rom.description,
        developer: metadata.developer || rom.developer,
        publisher: metadata.publisher || rom.publisher,
        releaseDate: metadata.releaseDate || rom.releaseDate,
        genre: metadata.genre || rom.genre,
        players: metadata.players || rom.players,
        rating: metadata.rating || rom.rating,
        coverArt: coverPath,
        screenshots: screenshots.length > 0 ? screenshots : rom.screenshots,
        region: metadata.region || rom.region,
        scrapedAt: new Date(),
      },
    });

    res.json({
      status: 'success',
      rom: updatedRom,
      metadata,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: 'Failed to scrape metadata' });
  }
});

// Batch scrape all unscraped ROMs
router.post('/scrape-all', authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const { system, limit = 50 } = req.body;

    const whereClause: any = {
      OR: [
        { description: null },
        { description: '' },
        { coverArt: null },
      ],
    };

    if (system) {
      whereClause.system = system;
    }

    const roms = await prisma.rom.findMany({
      where: whereClause,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    });

    // Queue scraping jobs (in production, use a job queue)
    const results = {
      total: roms.length,
      success: 0,
      failed: 0,
      skipped: 0,
    };

    // Process with rate limiting (1 per second for ScreenScraper)
    for (const rom of roms) {
      try {
        const metadata = await scrapeGameMetadata(rom.filepath, rom.system, rom.filename);
        
        if (metadata?.title) {
          let coverPath = rom.coverArt;
          if (metadata.coverUrl) {
            coverPath = await downloadCover(metadata.coverUrl, rom.id) || coverPath;
          }

          await prisma.rom.update({
            where: { id: rom.id },
            data: {
              title: metadata.title,
              description: metadata.description,
              developer: metadata.developer,
              publisher: metadata.publisher,
              genre: metadata.genre,
              coverArt: coverPath,
              scrapedAt: new Date(),
            },
          });

          results.success++;
        } else {
          results.skipped++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to scrape ${rom.filename}:`, error);
        results.failed++;
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Batch scrape error:', error);
    res.status(500).json({ error: 'Failed to batch scrape' });
  }
});

// Search for game metadata (manual lookup)
router.get('/search', authMiddleware, async (req: any, res) => {
  try {
    const { q, system } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results: ScrapedMetadata[] = [];

    // Search TheGamesDB
    if (system) {
      const tgdb = await scrapeTheGamesDB(q, system as string);
      if (tgdb) results.push({ ...tgdb, source: 'thegamesdb' } as any);
    }

    // Search LaunchBox
    const lb = await scrapeLaunchBox(q, system as string || '');
    if (lb) results.push({ ...lb, source: 'launchbox' } as any);

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// Apply metadata from search result
router.post('/apply/:romId', authMiddleware, async (req: any, res) => {
  try {
    const { romId } = req.params;
    const { metadata } = req.body;

    if (!metadata) {
      return res.status(400).json({ error: 'Metadata required' });
    }

    const rom = await prisma.rom.findUnique({ where: { id: romId } });
    
    if (!rom) {
      return res.status(404).json({ error: 'ROM not found' });
    }

    // Download cover if provided
    let coverPath = rom.coverArt;
    if (metadata.coverUrl) {
      coverPath = await downloadCover(metadata.coverUrl, romId) || coverPath;
    }

    const updatedRom = await prisma.rom.update({
      where: { id: romId },
      data: {
        title: metadata.title || rom.title,
        description: metadata.description || rom.description,
        developer: metadata.developer || rom.developer,
        publisher: metadata.publisher || rom.publisher,
        genre: metadata.genre || rom.genre,
        releaseDate: metadata.releaseDate || rom.releaseDate,
        rating: metadata.rating || rom.rating,
        coverArt: coverPath,
        scrapedAt: new Date(),
      },
    });

    res.json({ success: true, rom: updatedRom });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ error: 'Failed to apply metadata' });
  }
});

// Get scraping status
router.get('/status', authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const total = await prisma.rom.count();
    const scraped = await prisma.rom.count({ where: { scrapedAt: { not: null } } });
    const withCovers = await prisma.rom.count({ where: { coverArt: { not: null } } });
    const withDescriptions = await prisma.rom.count({ 
      where: { description: { not: null } } 
    });

    res.json({
      total,
      scraped,
      withCovers,
      withDescriptions,
      percentComplete: total > 0 ? Math.round((scraped / total) * 100) : 0,
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default router;
export { scrapeGameMetadata, calculateRomHash };
