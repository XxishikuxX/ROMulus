import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { param, query, body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get user's library
router.get('/',
  [
    query('system').optional(),
    query('favorites').optional().isBoolean().toBoolean(),
    query('search').optional().isString(),
    query('sortBy').optional().isIn(['title', 'lastPlayed', 'playCount', 'createdAt']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  async (req: AuthRequest, res) => {
    try {
      const {
        system,
        favorites,
        search,
        sortBy = 'lastPlayed',
        sortOrder = 'desc'
      } = req.query as any;

      const where: any = {
        userId: req.user!.id,
        isHidden: false
      };

      if (favorites) {
        where.isFavorite = true;
      }

      // Build ROM filter
      const romWhere: any = {};
      if (system) {
        romWhere.system = system;
      }
      if (search) {
        romWhere.title = { contains: search, mode: 'insensitive' };
      }

      const library = await prisma.userLibrary.findMany({
        where: {
          ...where,
          rom: romWhere
        },
        include: {
          rom: {
            select: {
              id: true,
              title: true,
              system: true,
              coverArt: true,
              genre: true,
              players: true,
              filesize: true
            }
          }
        },
        orderBy: sortBy === 'title' 
          ? { rom: { title: sortOrder } }
          : { [sortBy]: sortOrder }
      });

      // Format response
      const games = library.map(item => ({
        libraryId: item.id,
        romId: item.rom.id,
        title: item.rom.title,
        system: item.rom.system,
        coverArt: item.rom.coverArt,
        genre: item.rom.genre,
        players: item.rom.players,
        filesize: Number(item.rom.filesize),
        isFavorite: item.isFavorite,
        lastPlayed: item.lastPlayed,
        playCount: item.playCount,
        addedAt: item.createdAt
      }));

      res.json({
        games,
        total: games.length
      });
    } catch (error) {
      logger.error('Error getting library:', error);
      res.status(500).json({ error: 'Failed to get library' });
    }
  }
);

// Add ROM to library
router.post('/:romId',
  param('romId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { romId } = req.params;

      // Check ROM exists
      const rom = await prisma.rom.findUnique({ where: { id: romId } });
      if (!rom) {
        return res.status(404).json({ error: 'ROM not found' });
      }

      // Check not already in library
      const existing = await prisma.userLibrary.findUnique({
        where: {
          userId_romId: {
            userId: req.user!.id,
            romId
          }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Already in library' });
      }

      // Add to library
      const entry = await prisma.userLibrary.create({
        data: {
          userId: req.user!.id,
          romId
        },
        include: {
          rom: {
            select: {
              title: true,
              system: true
            }
          }
        }
      });

      logger.info(`User ${req.user!.id} added ${rom.title} to library`);
      res.status(201).json(entry);
    } catch (error) {
      logger.error('Error adding to library:', error);
      res.status(500).json({ error: 'Failed to add to library' });
    }
  }
);

// Remove ROM from library
router.delete('/:romId',
  param('romId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { romId } = req.params;

      const deleted = await prisma.userLibrary.deleteMany({
        where: {
          userId: req.user!.id,
          romId
        }
      });

      if (deleted.count === 0) {
        return res.status(404).json({ error: 'Not in library' });
      }

      res.json({ message: 'Removed from library' });
    } catch (error) {
      logger.error('Error removing from library:', error);
      res.status(500).json({ error: 'Failed to remove from library' });
    }
  }
);

// Toggle favorite
router.patch('/:romId/favorite',
  param('romId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { romId } = req.params;

      const entry = await prisma.userLibrary.findUnique({
        where: {
          userId_romId: {
            userId: req.user!.id,
            romId
          }
        }
      });

      if (!entry) {
        return res.status(404).json({ error: 'Not in library' });
      }

      const updated = await prisma.userLibrary.update({
        where: { id: entry.id },
        data: { isFavorite: !entry.isFavorite }
      });

      res.json({ isFavorite: updated.isFavorite });
    } catch (error) {
      logger.error('Error toggling favorite:', error);
      res.status(500).json({ error: 'Failed to update favorite' });
    }
  }
);

// Hide/unhide game
router.patch('/:romId/visibility',
  [
    param('romId').isUUID(),
    body('hidden').isBoolean()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { romId } = req.params;
      const { hidden } = req.body;

      const entry = await prisma.userLibrary.findUnique({
        where: {
          userId_romId: {
            userId: req.user!.id,
            romId
          }
        }
      });

      if (!entry) {
        return res.status(404).json({ error: 'Not in library' });
      }

      const updated = await prisma.userLibrary.update({
        where: { id: entry.id },
        data: { isHidden: hidden }
      });

      res.json({ isHidden: updated.isHidden });
    } catch (error) {
      logger.error('Error updating visibility:', error);
      res.status(500).json({ error: 'Failed to update visibility' });
    }
  }
);

// Get recently played
router.get('/recent', async (req: AuthRequest, res) => {
  try {
    const recent = await prisma.userLibrary.findMany({
      where: {
        userId: req.user!.id,
        lastPlayed: { not: null }
      },
      include: {
        rom: {
          select: {
            id: true,
            title: true,
            system: true,
            coverArt: true
          }
        }
      },
      orderBy: { lastPlayed: 'desc' },
      take: 10
    });

    res.json(recent.map(item => ({
      romId: item.rom.id,
      title: item.rom.title,
      system: item.rom.system,
      coverArt: item.rom.coverArt,
      lastPlayed: item.lastPlayed
    })));
  } catch (error) {
    logger.error('Error getting recent games:', error);
    res.status(500).json({ error: 'Failed to get recent games' });
  }
});

// Get library stats
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const [totalGames, favorites, systemCounts, totalPlaytime] = await Promise.all([
      prisma.userLibrary.count({
        where: { userId: req.user!.id }
      }),
      prisma.userLibrary.count({
        where: { userId: req.user!.id, isFavorite: true }
      }),
      prisma.userLibrary.groupBy({
        by: ['romId'],
        where: { userId: req.user!.id },
        _count: true
      }),
      prisma.playTime.aggregate({
        where: { userId: req.user!.id },
        _sum: { minutes: true }
      })
    ]);

    // Get system distribution
    const libraryWithSystems = await prisma.userLibrary.findMany({
      where: { userId: req.user!.id },
      include: {
        rom: { select: { system: true } }
      }
    });

    const systemDistribution: Record<string, number> = {};
    libraryWithSystems.forEach(item => {
      const system = item.rom.system;
      systemDistribution[system] = (systemDistribution[system] || 0) + 1;
    });

    res.json({
      totalGames,
      favorites,
      totalPlaytimeMinutes: totalPlaytime._sum.minutes || 0,
      systemDistribution
    });
  } catch (error) {
    logger.error('Error getting library stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
