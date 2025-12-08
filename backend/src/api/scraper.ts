import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Scraper sources configuration
const SCRAPERS = {
  screenscraper: {
    name: 'ScreenScraper',
    baseUrl: 'https://www.screenscraper.fr/api2',
    enabled: true,
  },
  thegamesdb: {
    name: 'TheGamesDB',
    baseUrl: 'https://api.thegamesdb.net/v1',
    enabled: true,
  },
  igdb: {
    name: 'IGDB',
    baseUrl: 'https://api.igdb.com/v4',
    enabled: false,
  },
  rawg: {
    name: 'RAWG',
    baseUrl: 'https://api.rawg.io/api',
    enabled: true,
  },
};

// System ID mappings for ScreenScraper
const SYSTEM_IDS: Record<string, number> = {
  NES: 3, SNES: 4, N64: 14, GAMECUBE: 13, WII: 16, WIIU: 18,
  GB: 9, GBC: 10, GBA: 12, NDS: 15, N3DS: 17,
  PS1: 57, PS2: 58, PS3: 59, PSP: 61, VITA: 62,
  GENESIS: 1, SATURN: 22, DREAMCAST: 23, MASTERSYSTEM: 2, GAMEGEAR: 21,
  XBOX: 32, XBOX360: 33,
  ARCADE: 75, NEOGEO: 142,
};

interface ScrapedData {
  title?: string;
  description?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  players?: string;
  rating?: number;
  coverUrl?: string;
  screenshotUrls?: string[];
}

// Scrape from ScreenScraper
async function scrapeScreenScraper(
  romPath: string,
  system: string,
  credentials: { devid: string; devpassword: string; softname: string; ssid?: string; sspassword?: string }
): Promise<ScrapedData | null> {
  try {
    const romBuffer = fs.readFileSync(romPath);
    const md5 = crypto.createHash('md5').update(romBuffer).digest('hex');
    const sha1 = crypto.createHash('sha1').update(romBuffer).digest('hex');
    const fileSize = romBuffer.length;

    const systemId = SYSTEM_IDS[system] || 0;
    
    const params = new URLSearchParams({
      devid: credentials.devid,
      devpassword: credentials.devpassword,
      softname: credentials.softname,
      output: 'json',
      md5,
      sha1,
      systemeid: systemId.toString(),
      romtaille: fileSize.toString(),
    });

    if (credentials.ssid && credentials.sspassword) {
      params.set('ssid', credentials.ssid);
      params.set('sspassword', credentials.sspassword);
    }

    const response = await fetch(`${SCRAPERS.screenscraper.baseUrl}/jeuInfos.php?${params}`);
    if (!response.ok) return null;

    const data: any = await response.json();
    const game = data?.response?.jeu;
    if (!game) return null;

    return {
      title: game.noms?.find((n: any) => n.region === 'ss')?.text || game.noms?.[0]?.text,
      description: game.synopsis?.find((s: any) => s.langue === 'en')?.text || game.synopsis?.[0]?.text,
      releaseDate: game.dates?.find((d: any) => d.region === 'ss')?.text || game.dates?.[0]?.text,
      developer: game.developpeur?.text,
      publisher: game.editeur?.text,
      genre: game.genres?.map((g: any) => g.noms?.find((n: any) => n.langue === 'en')?.text).filter(Boolean).join(', '),
      players: game.joueurs?.text,
      rating: game.note?.text ? parseFloat(game.note.text) / 20 : undefined,
      coverUrl: game.medias?.find((m: any) => m.type === 'box-2D')?.url,
      screenshotUrls: game.medias?.filter((m: any) => m.type === 'ss')?.map((m: any) => m.url) || [],
    };
  } catch (error) {
    console.error('ScreenScraper error:', error);
    return null;
  }
}

// Scrape from TheGamesDB
async function scrapeTheGamesDB(title: string, system: string, apiKey: string): Promise<ScrapedData | null> {
  try {
    const platformMap: Record<string, number> = {
      NES: 7, SNES: 6, N64: 3, GAMECUBE: 2, WII: 9, WIIU: 38,
      GB: 4, GBC: 41, GBA: 5, NDS: 8, N3DS: 4912,
      PS1: 10, PS2: 11, PS3: 12, PSP: 13, VITA: 39,
      GENESIS: 18, SATURN: 17, DREAMCAST: 16, MASTERSYSTEM: 35, GAMEGEAR: 20,
      XBOX: 14, XBOX360: 15,
    };

    const platformId = platformMap[system];
    const params = new URLSearchParams({
      apikey: apiKey,
      name: title,
      'filter[platform]': platformId?.toString() || '',
      include: 'boxart,platform',
    });

    const response = await fetch(`${SCRAPERS.thegamesdb.baseUrl}/Games/ByGameName?${params}`);
    if (!response.ok) return null;

    const data: any = await response.json();
    const game = data?.data?.games?.[0];
    if (!game) return null;

    const boxart = data?.include?.boxart?.data?.[game.id];
    const baseUrl = data?.include?.boxart?.base_url?.original || '';

    return {
      title: game.game_title,
      description: game.overview,
      releaseDate: game.release_date,
      developer: data?.include?.developers?.[game.developers?.[0]]?.name,
      publisher: data?.include?.publishers?.[game.publishers?.[0]]?.name,
      players: game.players?.toString(),
      genre: game.genres?.map((g: number) => data?.include?.genres?.[g]?.name).filter(Boolean).join(', '),
      rating: game.rating ? parseFloat(game.rating) : undefined,
      coverUrl: boxart?.find((b: any) => b.side === 'front')
        ? `${baseUrl}${boxart.find((b: any) => b.side === 'front').filename}`
        : undefined,
      screenshotUrls: data?.include?.images?.data?.[game.id]
        ?.filter((i: any) => i.type === 'screenshot')
        ?.map((i: any) => `${data?.include?.images?.base_url?.original}${i.filename}`)
        || [],
    };
  } catch (error) {
    console.error('TheGamesDB error:', error);
    return null;
  }
}

// Scrape from RAWG
async function scrapeRAWG(title: string, apiKey: string): Promise<ScrapedData | null> {
  try {
    const searchParams = new URLSearchParams({
      key: apiKey,
      search: title,
      page_size: '1',
    });

    const searchResponse = await fetch(`${SCRAPERS.rawg.baseUrl}/games?${searchParams}`);
    if (!searchResponse.ok) return null;

    const searchData: any = await searchResponse.json();
    const games = searchData?.results;
    if (!games || games.length === 0) return null;

    const game = games[0];

    const detailResponse = await fetch(`${SCRAPERS.rawg.baseUrl}/games/${game.id}?key=${apiKey}`);
    if (!detailResponse.ok) return null;

    const detail: any = await detailResponse.json();

    return {
      title: detail.name,
      description: detail.description_raw,
      releaseDate: detail.released,
      developer: detail.developers?.[0]?.name,
      publisher: detail.publishers?.[0]?.name,
      genre: detail.genres?.map((g: any) => g.name).join(', '),
      rating: detail.rating ? detail.rating * 2 : undefined,
      coverUrl: detail.background_image,
      screenshotUrls: [],
    };
  } catch (error) {
    console.error('RAWG error:', error);
    return null;
  }
}

// Main scrape endpoint
router.post('/scrape/:romId', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { romId } = req.params;
    const { source, credentials } = req.body;

    const rom = await prisma.rom.findUnique({ where: { id: romId } });
    if (!rom) {
      return res.status(404).json({ error: 'ROM not found' });
    }

    let scrapedData: ScrapedData | null = null;

    switch (source) {
      case 'screenscraper':
        if (credentials?.devid && credentials?.devpassword) {
          scrapedData = await scrapeScreenScraper(rom.filepath, rom.system, credentials);
        }
        break;
      case 'thegamesdb':
        if (credentials?.apiKey) {
          scrapedData = await scrapeTheGamesDB(rom.title, rom.system, credentials.apiKey);
        }
        break;
      case 'rawg':
        if (credentials?.apiKey) {
          scrapedData = await scrapeRAWG(rom.title, credentials.apiKey);
        }
        break;
      default:
        return res.status(400).json({ error: 'Invalid scraper source' });
    }

    if (!scrapedData) {
      return res.status(404).json({ error: 'No data found' });
    }

    // Update ROM with scraped data
    const updateData: any = {
      scrapedAt: new Date(),
    };

    if (scrapedData.title) updateData.title = scrapedData.title;
    if (scrapedData.description) updateData.description = scrapedData.description;
    if (scrapedData.releaseDate) updateData.releaseDate = scrapedData.releaseDate;
    if (scrapedData.developer) updateData.developer = scrapedData.developer;
    if (scrapedData.publisher) updateData.publisher = scrapedData.publisher;
    if (scrapedData.genre) updateData.genre = scrapedData.genre;
    if (scrapedData.players) updateData.players = scrapedData.players;
    if (scrapedData.rating) updateData.rating = scrapedData.rating;

    // Download and save cover art
    if (scrapedData.coverUrl) {
      try {
        const coverResponse = await fetch(scrapedData.coverUrl);
        if (coverResponse.ok) {
          const coverBuffer = Buffer.from(await coverResponse.arrayBuffer());
          const coverDir = process.env.COVER_DIR || '/opt/romulus/data/covers';
          const coverFilename = `${romId}.jpg`;
          const coverPath = path.join(coverDir, coverFilename);
          
          fs.mkdirSync(coverDir, { recursive: true });
          fs.writeFileSync(coverPath, coverBuffer);
          updateData.coverArt = `/covers/${coverFilename}`;
        }
      } catch (e) {
        console.error('Failed to download cover:', e);
      }
    }

    const updatedRom = await prisma.rom.update({
      where: { id: romId },
      data: updateData,
    });

    res.json({
      success: true,
      rom: updatedRom,
      scrapedData,
    });
  } catch (error: any) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: 'Scraping failed' });
  }
});

// Get available scrapers
router.get('/sources', authMiddleware, async (req: AuthRequest, res: Response) => {
  res.json({
    sources: Object.entries(SCRAPERS).map(([id, info]) => ({
      id,
      name: info.name,
      enabled: info.enabled,
    })),
  });
});

// Bulk scrape endpoint
router.post('/bulk', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { romIds, source, credentials } = req.body;

    if (!Array.isArray(romIds) || romIds.length === 0) {
      return res.status(400).json({ error: 'No ROMs specified' });
    }

    const results: { romId: string; success: boolean; error?: string }[] = [];

    for (const romId of romIds) {
      try {
        const rom = await prisma.rom.findUnique({ where: { id: romId } });
        if (!rom) {
          results.push({ romId, success: false, error: 'ROM not found' });
          continue;
        }

        let scrapedData: ScrapedData | null = null;

        if (source === 'thegamesdb' && credentials?.apiKey) {
          scrapedData = await scrapeTheGamesDB(rom.title, rom.system, credentials.apiKey);
        } else if (source === 'rawg' && credentials?.apiKey) {
          scrapedData = await scrapeRAWG(rom.title, credentials.apiKey);
        }

        if (scrapedData) {
          const updateData: any = { scrapedAt: new Date() };
          if (scrapedData.description) updateData.description = scrapedData.description;
          if (scrapedData.developer) updateData.developer = scrapedData.developer;
          if (scrapedData.publisher) updateData.publisher = scrapedData.publisher;
          if (scrapedData.genre) updateData.genre = scrapedData.genre;

          await prisma.rom.update({ where: { id: romId }, data: updateData });
          results.push({ romId, success: true });
        } else {
          results.push({ romId, success: false, error: 'No data found' });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e: any) {
        results.push({ romId, success: false, error: e.message });
      }
    }

    res.json({ results });
  } catch (error: any) {
    console.error('Bulk scrape error:', error);
    res.status(500).json({ error: 'Bulk scraping failed' });
  }
});

export default router;
