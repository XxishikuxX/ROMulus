import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { query } from 'express-validator';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get user statistics overview
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get various stats in parallel
    const [
      totalPlaytime,
      gamesPlayed,
      libraryCount,
      achievementCount,
      recentSessions,
      friendCount
    ] = await Promise.all([
      // Total playtime
      prisma.playTime.aggregate({
        where: { userId },
        _sum: { minutes: true }
      }),
      // Unique games played
      prisma.playTime.groupBy({
        by: ['romId'],
        where: { userId }
      }),
      // Library size
      prisma.userLibrary.count({ where: { userId } }),
      // Achievements
      prisma.userAchievement.count({ where: { userId } }),
      // Recent sessions
      prisma.gameSession.findMany({
        where: { userId },
        include: {
          rom: { select: { title: true, system: true, coverArt: true } }
        },
        orderBy: { startedAt: 'desc' },
        take: 5
      }),
      // Friends
      prisma.friendship.count({
        where: {
          OR: [
            { adderId: userId, status: 'ACCEPTED' },
            { receiverId: userId, status: 'ACCEPTED' }
          ]
        }
      })
    ]);

    const totalMinutes = totalPlaytime._sum.minutes || 0;

    res.json({
      totalPlaytime: {
        minutes: totalMinutes,
        hours: Math.floor(totalMinutes / 60),
        formatted: formatPlaytime(totalMinutes)
      },
      gamesPlayed: gamesPlayed.length,
      librarySize: libraryCount,
      achievements: achievementCount,
      friends: friendCount,
      recentGames: recentSessions.map(s => ({
        id: s.romId,
        title: s.rom.title,
        system: s.rom.system,
        coverArt: s.rom.coverArt,
        lastPlayed: s.startedAt,
        duration: s.duration
      }))
    });
  } catch (error) {
    logger.error('Error getting stats overview:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get playtime by period
router.get('/playtime',
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year', 'all']),
    query('system').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { period = 'month', system } = req.query as any;

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(0);
      }

      // Build where clause
      const where: any = {
        userId,
        date: { gte: startDate }
      };

      // Filter by system if specified
      let romFilter: string[] | undefined;
      if (system) {
        const systemRoms = await prisma.rom.findMany({
          where: { system: system },
          select: { id: true }
        });
        romFilter = systemRoms.map(r => r.id);
        where.romId = { in: romFilter };
      }

      // Get playtime data
      const playtimeData = await prisma.playTime.findMany({
        where,
        include: {
          rom: {
            select: { title: true, system: true, coverArt: true }
          }
        },
        orderBy: { date: 'asc' }
      });

      // Aggregate by date for chart
      const dailyData: Record<string, number> = {};
      const gameData: Record<string, { title: string; system: string; minutes: number; coverArt: string | null }> = {};

      playtimeData.forEach(pt => {
        const dateKey = pt.date.toISOString().split('T')[0];
        dailyData[dateKey] = (dailyData[dateKey] || 0) + pt.minutes;

        if (!gameData[pt.romId]) {
          gameData[pt.romId] = {
            title: pt.rom.title,
            system: pt.rom.system,
            minutes: 0,
            coverArt: pt.rom.coverArt
          };
        }
        gameData[pt.romId].minutes += pt.minutes;
      });

      // Sort games by playtime
      const topGames = Object.entries(gameData)
        .sort((a, b) => b[1].minutes - a[1].minutes)
        .slice(0, 10)
        .map(([romId, data]) => ({
          romId,
          ...data,
          formatted: formatPlaytime(data.minutes)
        }));

      // Format daily data for chart
      const chartData = Object.entries(dailyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, minutes]) => ({
          date,
          minutes,
          hours: Math.round(minutes / 6) / 10 // Round to 1 decimal
        }));

      const totalMinutes = Object.values(dailyData).reduce((a, b) => a + b, 0);

      res.json({
        period,
        totalPlaytime: {
          minutes: totalMinutes,
          formatted: formatPlaytime(totalMinutes)
        },
        dailyChart: chartData,
        topGames
      });
    } catch (error) {
      logger.error('Error getting playtime stats:', error);
      res.status(500).json({ error: 'Failed to get playtime stats' });
    }
  }
);

// Get playtime by system
router.get('/systems', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const playtimeData = await prisma.playTime.findMany({
      where: { userId },
      include: {
        rom: {
          select: { system: true }
        }
      }
    });

    // Aggregate by system
    const systemData: Record<string, number> = {};
    playtimeData.forEach(pt => {
      const system = pt.rom.system;
      systemData[system] = (systemData[system] || 0) + pt.minutes;
    });

    const systems = Object.entries(systemData)
      .sort((a, b) => b[1] - a[1])
      .map(([system, minutes]) => ({
        system,
        minutes,
        formatted: formatPlaytime(minutes),
        percentage: Math.round((minutes / Object.values(systemData).reduce((a, b) => a + b, 0)) * 100)
      }));

    res.json(systems);
  } catch (error) {
    logger.error('Error getting system stats:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

// Get game recommendations
router.get('/recommendations', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get user's play history
    const playHistory = await prisma.playTime.findMany({
      where: { userId },
      include: {
        rom: {
          select: { id: true, system: true, genre: true }
        }
      }
    });

    // Analyze preferences
    const systemCounts: Record<string, number> = {};
    const genreCounts: Record<string, number> = {};
    const playedRomIds = new Set<string>();

    playHistory.forEach(pt => {
      playedRomIds.add(pt.romId);
      systemCounts[pt.rom.system] = (systemCounts[pt.rom.system] || 0) + pt.minutes;
      pt.rom.genre.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + pt.minutes;
      });
    });

    // Get top systems and genres
    const topSystems = Object.entries(systemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);

    // Find recommendations
    const recommendations = await prisma.rom.findMany({
      where: {
        AND: [
          { id: { notIn: Array.from(playedRomIds) } },
          { isPublic: true },
          {
            OR: [
              { system: { in: topSystems as any } },
              { genre: { hasSome: topGenres } }
            ]
          }
        ]
      },
      select: {
        id: true,
        title: true,
        system: true,
        coverArt: true,
        genre: true,
        rating: true,
        description: true
      },
      take: 20
    });

    // Score and sort recommendations
    const scored = recommendations.map(rom => {
      let score = 0;
      
      // System match
      const systemIndex = topSystems.indexOf(rom.system);
      if (systemIndex >= 0) {
        score += (3 - systemIndex) * 10;
      }
      
      // Genre matches
      rom.genre.forEach(genre => {
        const genreIndex = topGenres.indexOf(genre);
        if (genreIndex >= 0) {
          score += (5 - genreIndex) * 5;
        }
      });

      // Rating bonus
      if (rom.rating) {
        score += rom.rating * 2;
      }

      return { ...rom, score };
    });

    const sorted = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    // Group by reason
    const basedOnSystems = sorted.filter(r => topSystems.includes(r.system)).slice(0, 4);
    const basedOnGenres = sorted.filter(r => 
      r.genre.some(g => topGenres.includes(g)) && !basedOnSystems.includes(r)
    ).slice(0, 4);
    const popular = sorted.filter(r => 
      !basedOnSystems.includes(r) && !basedOnGenres.includes(r)
    ).slice(0, 4);

    res.json({
      recommendations: {
        basedOnSystems: {
          reason: `Because you play ${topSystems[0]} games`,
          games: basedOnSystems
        },
        basedOnGenres: {
          reason: `Because you like ${topGenres[0]} games`,
          games: basedOnGenres
        },
        popular: {
          reason: 'Popular games you might enjoy',
          games: popular
        }
      },
      preferences: {
        topSystems,
        topGenres
      }
    });
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Get achievements
router.get('/achievements', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [userAchievements, allAchievements] = await Promise.all([
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' }
      }),
      prisma.achievement.findMany({
        orderBy: { points: 'desc' }
      })
    ]);

    const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId));

    const unlocked = userAchievements.map(ua => ({
      ...ua.achievement,
      unlockedAt: ua.unlockedAt
    }));

    const locked = allAchievements
      .filter(a => !unlockedIds.has(a.id) && !a.isSecret)
      .map(a => ({
        ...a,
        unlockedAt: null
      }));

    const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0);
    const maxPoints = allAchievements.reduce((sum, a) => sum + a.points, 0);

    res.json({
      unlocked,
      locked,
      stats: {
        totalUnlocked: unlocked.length,
        totalAchievements: allAchievements.length,
        points: totalPoints,
        maxPoints,
        percentage: Math.round((unlocked.length / allAchievements.length) * 100)
      }
    });
  } catch (error) {
    logger.error('Error getting achievements:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

// Get gaming history (sessions)
router.get('/history',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 20 } = req.query as any;

      const [sessions, total] = await Promise.all([
        prisma.gameSession.findMany({
          where: { userId, endedAt: { not: null } },
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
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.gameSession.count({
          where: { userId, endedAt: { not: null } }
        })
      ]);

      res.json({
        sessions: sessions.map(s => ({
          id: s.id,
          rom: s.rom,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          duration: s.duration,
          formatted: formatPlaytime(s.duration ? Math.floor(s.duration / 60) : 0)
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting history:', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  }
);

// Get leaderboard
router.get('/leaderboard',
  query('type').optional().isIn(['playtime', 'games', 'achievements']),
  async (req, res) => {
    try {
      const { type = 'playtime' } = req.query as any;

      let leaderboard;

      switch (type) {
        case 'playtime':
          const playtimeData = await prisma.playTime.groupBy({
            by: ['userId'],
            _sum: { minutes: true },
            orderBy: { _sum: { minutes: 'desc' } },
            take: 50
          });

          const userIds = playtimeData.map(p => p.userId);
          const users = await prisma.user.findMany({
            where: { id: { in: userIds }, isBanned: false },
            select: { id: true, username: true, avatar: true }
          });
          const userMap = new Map(users.map(u => [u.id, u]));

          leaderboard = playtimeData
            .filter(p => userMap.has(p.userId))
            .map((p, i) => ({
              rank: i + 1,
              user: userMap.get(p.userId),
              value: p._sum.minutes || 0,
              formatted: formatPlaytime(p._sum.minutes || 0)
            }));
          break;

        case 'achievements':
          const achievementData = await prisma.userAchievement.groupBy({
            by: ['userId'],
            _count: true,
            orderBy: { _count: { _all: 'desc' } },
            take: 50
          });

          const achUserIds = achievementData.map(a => a.userId);
          const achUsers = await prisma.user.findMany({
            where: { id: { in: achUserIds }, isBanned: false },
            select: { id: true, username: true, avatar: true }
          });
          const achUserMap = new Map(achUsers.map(u => [u.id, u]));

          leaderboard = achievementData
            .filter(a => achUserMap.has(a.userId))
            .map((a, i) => ({
              rank: i + 1,
              user: achUserMap.get(a.userId),
              value: a._count,
              label: `${a._count} achievements`
            }));
          break;

        default:
          leaderboard = [];
      }

      res.json({ type, leaderboard });
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      res.status(500).json({ error: 'Failed to get leaderboard' });
    }
  }
);

// Helper function to format playtime
function formatPlaytime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export default router;
