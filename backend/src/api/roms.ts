import { Router } from 'express';
import { PrismaClient, GameSystem } from '@prisma/client';
import { query, param, body, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// System info mapping
const SYSTEM_INFO: Record<GameSystem, { name: string; extensions: string[]; folder: string }> = {
  PS3: { name: 'PlayStation 3', extensions: ['.iso', '.pkg'], folder: 'ps3' },
  PS2: { name: 'PlayStation 2', extensions: ['.iso', '.bin', '.img'], folder: 'ps2' },
  PS1: { name: 'PlayStation 1', extensions: ['.bin', '.cue', '.iso', '.img', '.pbp'], folder: 'ps1' },
  PSP: { name: 'PlayStation Portable', extensions: ['.iso', '.cso', '.pbp'], folder: 'psp' },
  VITA: { name: 'PlayStation Vita', extensions: ['.vpk', '.mai'], folder: 'vita' },
  XBOX: { name: 'Xbox', extensions: ['.iso', '.xiso'], folder: 'xbox' },
  XBOX360: { name: 'Xbox 360', extensions: ['.iso', '.xex'], folder: 'xbox360' },
  WIIU: { name: 'Wii U', extensions: ['.wud', '.wux', '.rpx'], folder: 'wiiu' },
  WII: { name: 'Nintendo Wii', extensions: ['.iso', '.wbfs', '.rvz'], folder: 'wii' },
  GAMECUBE: { name: 'Nintendo GameCube', extensions: ['.iso', '.gcz', '.rvz'], folder: 'gamecube' },
  N3DS: { name: 'Nintendo 3DS', extensions: ['.3ds', '.cia', '.cxi'], folder: '3ds' },
  NDS: { name: 'Nintendo DS', extensions: ['.nds', '.dsi'], folder: 'nds' },
  N64: { name: 'Nintendo 64', extensions: ['.n64', '.z64', '.v64'], folder: 'n64' },
  SNES: { name: 'Super Nintendo', extensions: ['.sfc', '.smc'], folder: 'snes' },
  NES: { name: 'Nintendo Entertainment System', extensions: ['.nes', '.unf'], folder: 'nes' },
  GBA: { name: 'Game Boy Advance', extensions: ['.gba'], folder: 'gba' },
  GBC: { name: 'Game Boy Color', extensions: ['.gbc'], folder: 'gbc' },
  GB: { name: 'Game Boy', extensions: ['.gb'], folder: 'gb' },
  DREAMCAST: { name: 'Sega Dreamcast', extensions: ['.gdi', '.cdi', '.chd'], folder: 'dreamcast' },
  SATURN: { name: 'Sega Saturn', extensions: ['.iso', '.bin', '.cue'], folder: 'saturn' },
  GENESIS: { name: 'Sega Genesis/Mega Drive', extensions: ['.md', '.gen', '.bin'], folder: 'genesis' },
  SEGACD: { name: 'Sega CD', extensions: ['.iso', '.bin', '.cue'], folder: 'segacd' },
  S32X: { name: 'Sega 32X', extensions: ['.32x', '.bin'], folder: '32x' },
  SMS: { name: 'Sega Master System', extensions: ['.sms'], folder: 'mastersystem' },
  GAMEGEAR: { name: 'Sega Game Gear', extensions: ['.gg'], folder: 'gamegear' }
};

// Get all systems info
router.get('/systems', (req, res) => {
  const systems = Object.entries(SYSTEM_INFO).map(([key, value]) => ({
    id: key,
    ...value
  }));
  res.json(systems);
});

// List ROMs with filtering and pagination
router.get('/',
  [
    query('system').optional().isIn(Object.keys(SYSTEM_INFO)),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sortBy').optional().isIn(['title', 'createdAt', 'filesize', 'rating']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('genre').optional().isString(),
    query('players').optional().isInt({ min: 1 }).toInt()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        system,
        search,
        page = 1,
        limit = 50,
        sortBy = 'title',
        sortOrder = 'asc',
        genre,
        players
      } = req.query as any;

      // Build where clause
      const where: any = {
        isPublic: true
      };

      if (system) {
        where.system = system;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { developer: { contains: search, mode: 'insensitive' } },
          { publisher: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (genre) {
        where.genre = { has: genre };
      }

      if (players) {
        where.players = { gte: players };
      }

      // Get total count
      const total = await prisma.rom.count({ where });

      // Get ROMs
      const roms = await prisma.rom.findMany({
        where,
        select: {
          id: true,
          title: true,
          system: true,
          region: true,
          filesize: true,
          coverArt: true,
          genre: true,
          players: true,
          rating: true,
          developer: true,
          publisher: true,
          releaseDate: true,
          createdAt: true
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit
      });

      // Format response
      const formattedRoms = roms.map(rom => ({
        ...rom,
        filesize: Number(rom.filesize),
        systemName: SYSTEM_INFO[rom.system]?.name || rom.system
      }));

      res.json({
        roms: formattedRoms,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error listing ROMs:', error);
      res.status(500).json({ error: 'Failed to list ROMs' });
    }
  }
);

// Get ROM details
router.get('/:id',
  param('id').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const rom = await prisma.rom.findUnique({
        where: { id },
        include: {
          uploadedBy: {
            select: {
              id: true,
              username: true
            }
          },
          _count: {
            select: {
              sessions: true,
              userLibraries: true
            }
          }
        }
      });

      if (!rom) {
        return res.status(404).json({ error: 'ROM not found' });
      }

      // Check access
      if (!rom.isPublic && rom.uploadedById !== req.user?.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check if in user's library
      const inLibrary = await prisma.userLibrary.findUnique({
        where: {
          userId_romId: {
            userId: req.user!.id,
            romId: id
          }
        }
      });

      // Get user's save states for this ROM
      const saves = await prisma.saveState.findMany({
        where: {
          userId: req.user!.id,
          romId: id
        },
        orderBy: { updatedAt: 'desc' }
      });

      res.json({
        ...rom,
        filesize: Number(rom.filesize),
        systemName: SYSTEM_INFO[rom.system]?.name || rom.system,
        inLibrary: !!inLibrary,
        isFavorite: inLibrary?.isFavorite || false,
        playCount: inLibrary?.playCount || 0,
        saves
      });
    } catch (error) {
      logger.error('Error getting ROM details:', error);
      res.status(500).json({ error: 'Failed to get ROM details' });
    }
  }
);

// Get genres for a system
router.get('/genres/:system',
  param('system').isIn(Object.keys(SYSTEM_INFO)),
  async (req, res) => {
    try {
      const { system } = req.params;

      const roms = await prisma.rom.findMany({
        where: { system: system as GameSystem, isPublic: true },
        select: { genre: true }
      });

      // Extract unique genres
      const genres = [...new Set(roms.flatMap(r => r.genre))].sort();

      res.json(genres);
    } catch (error) {
      logger.error('Error getting genres:', error);
      res.status(500).json({ error: 'Failed to get genres' });
    }
  }
);

// Random ROM (for discovery)
router.get('/random/:system',
  param('system').optional().isIn(Object.keys(SYSTEM_INFO)),
  async (req, res) => {
    try {
      const { system } = req.params;

      const where: any = { isPublic: true };
      if (system) {
        where.system = system;
      }

      const count = await prisma.rom.count({ where });
      const skip = Math.floor(Math.random() * count);

      const rom = await prisma.rom.findFirst({
        where,
        skip,
        select: {
          id: true,
          title: true,
          system: true,
          coverArt: true,
          description: true
        }
      });

      res.json(rom);
    } catch (error) {
      logger.error('Error getting random ROM:', error);
      res.status(500).json({ error: 'Failed to get random ROM' });
    }
  }
);

// Search ROMs (autocomplete)
router.get('/search/autocomplete',
  query('q').isString().isLength({ min: 2 }),
  async (req, res) => {
    try {
      const { q } = req.query;

      const roms = await prisma.rom.findMany({
        where: {
          isPublic: true,
          title: { contains: q as string, mode: 'insensitive' }
        },
        select: {
          id: true,
          title: true,
          system: true,
          coverArt: true
        },
        take: 10,
        orderBy: { title: 'asc' }
      });

      res.json(roms.map(rom => ({
        ...rom,
        systemName: SYSTEM_INFO[rom.system]?.name || rom.system
      })));
    } catch (error) {
      logger.error('Error in autocomplete:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

// Update ROM metadata (admin or uploader only)
router.patch('/:id',
  [
    param('id').isUUID(),
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('genre').optional().isArray(),
    body('developer').optional().isString(),
    body('publisher').optional().isString(),
    body('players').optional().isInt({ min: 1 }),
    body('region').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const rom = await prisma.rom.findUnique({ where: { id } });
      if (!rom) {
        return res.status(404).json({ error: 'ROM not found' });
      }

      // Check permission
      if (rom.uploadedById !== req.user?.id && req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Permission denied' });
      }

      const updatedRom = await prisma.rom.update({
        where: { id },
        data: updates
      });

      res.json(updatedRom);
    } catch (error) {
      logger.error('Error updating ROM:', error);
      res.status(500).json({ error: 'Failed to update ROM' });
    }
  }
);

// Delete ROM (admin only)
router.delete('/:id',
  param('id').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;

      const rom = await prisma.rom.findUnique({ where: { id } });
      if (!rom) {
        return res.status(404).json({ error: 'ROM not found' });
      }

      // Delete file
      try {
        await fs.unlink(rom.filepath);
      } catch (e) {
        logger.warn(`Could not delete ROM file: ${rom.filepath}`);
      }

      // Delete from database
      await prisma.rom.delete({ where: { id } });

      logger.info(`ROM deleted: ${rom.title} by ${req.user.id}`);
      res.json({ message: 'ROM deleted successfully' });
    } catch (error) {
      logger.error('Error deleting ROM:', error);
      res.status(500).json({ error: 'Failed to delete ROM' });
    }
  }
);

export default router;
