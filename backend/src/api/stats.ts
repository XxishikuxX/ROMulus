import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get user stats dashboard
router.get('/dashboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get total playtime
    const playtimeAgg = await prisma.playTime.aggregate({
      where: { userId },
      _sum: { minutes: true },
    });

    // Get games played count
    const gamesPlayed = await prisma.playTime.groupBy({
      by: ['romId'],
      where: { userId },
    });

    // Get achievements count
    const achievementsCount = await prisma.userAchievement.count({
      where: { userId },
    });

    // Get recent sessions
    const recentSessions = await prisma.gameSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        rom: {
          select: {
            id: true,
            title: true,
            system: true,
            coverArt: true,
          },
        },
      },
    });

    // Get playtime by system
    const playtimeBySystem = await prisma.playTime.groupBy({
      by: ['romId'],
      where: { userId },
      _sum: { minutes: true },
    });

    // Get system breakdown
    const systemBreakdown: Record<string, number> = {};
    for (const pt of playtimeBySystem) {
      const rom = await prisma.rom.findUnique({
        where: { id: pt.romId },
        select: { system: true },
      });
      if (rom) {
        systemBreakdown[rom.system] = (systemBreakdown[rom.system] || 0) + (pt._sum.minutes || 0);
      }
    }

    // Get top games
    const topGames = await prisma.playTime.groupBy({
      by: ['romId'],
      where: { userId },
      _sum: { minutes: true },
      orderBy: { _sum: { minutes: 'desc' } },
      take: 5,
    });

    const topGamesWithDetails = await Promise.all(
      topGames.map(async (tg) => {
        const rom = await prisma.rom.findUnique({
          where: { id: tg.romId },
          select: { id: true, title: true, system: true, coverArt: true },
        });
        return {
          rom,
          minutes: tg._sum.minutes || 0,
        };
      })
    );

    res.json({
      totalPlaytime: playtimeAgg._sum.minutes || 0,
      gamesPlayed: gamesPlayed.length,
      achievementsUnlocked: achievementsCount,
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        rom: s.rom,
        startedAt: s.startedAt,
        duration: s.duration,
      })),
      playtimeBySystem: Object.entries(systemBreakdown).map(([system, minutes]) => ({
        system,
        minutes,
        hours: Math.round((minutes / 60) * 10) / 10,
      })),
      topGames: topGamesWithDetails,
    });
  } catch (error: any) {
    console.error('Stats dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get playtime history
router.get('/playtime', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const playtime = await prisma.playTime.findMany({
      where: {
        userId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    // Group by date
    const byDate: Record<string, number> = {};
    playtime.forEach((pt) => {
      const dateStr = pt.date.toISOString().split('T')[0];
      byDate[dateStr] = (byDate[dateStr] || 0) + pt.minutes;
    });

    // Fill in missing dates
    const result: { date: string; minutes: number }[] = [];
    const current = new Date(startDate);
    const today = new Date();

    while (current <= today) {
      const dateStr = current.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        minutes: byDate[dateStr] || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    res.json({ playtime: result });
  } catch (error: any) {
    console.error('Playtime error:', error);
    res.status(500).json({ error: 'Failed to fetch playtime' });
  }
});

// Get recommendations
router.get('/recommendations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's play history
    const playHistory = await prisma.playTime.findMany({
      where: { userId },
      include: {
        rom: {
          select: {
            id: true,
            system: true,
            genre: true,
          },
        },
      },
      orderBy: { minutes: 'desc' },
      take: 50,
    });

    // Analyze preferences
    const systemCounts: Record<string, number> = {};
    const genreCounts: Record<string, number> = {};
    const playedRomIds = new Set<string>();

    playHistory.forEach((pt) => {
      playedRomIds.add(pt.romId);
      systemCounts[pt.rom.system] = (systemCounts[pt.rom.system] || 0) + pt.minutes;
      
      // Genre is a string, split by comma
      if (pt.rom.genre) {
        const genres = pt.rom.genre.split(',').map((g) => g.trim());
        genres.forEach((genre) => {
          if (genre) {
            genreCounts[genre] = (genreCounts[genre] || 0) + pt.minutes;
          }
        });
      }
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

    // Find recommendations - get games from favorite systems
    const recommendations = await prisma.rom.findMany({
      where: {
        AND: [
          { id: { notIn: Array.from(playedRomIds) } },
          { isPublic: true },
          { system: { in: topSystems as any } },
        ],
      },
      select: {
        id: true,
        title: true,
        system: true,
        coverArt: true,
        genre: true,
        rating: true,
        description: true,
      },
      take: 20,
    });

    // Score and sort recommendations
    const scored = recommendations.map((rom) => {
      let score = 0;

      // System match
      const systemIndex = topSystems.indexOf(rom.system);
      if (systemIndex >= 0) {
        score += (3 - systemIndex) * 10;
      }

      // Genre matches
      if (rom.genre) {
        const romGenres = rom.genre.split(',').map((g) => g.trim());
        romGenres.forEach((genre) => {
          const genreIndex = topGenres.indexOf(genre);
          if (genreIndex >= 0) {
            score += (5 - genreIndex) * 5;
          }
        });
      }

      // Rating bonus
      if (rom.rating) {
        score += rom.rating * 2;
      }

      return { ...rom, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score).slice(0, 12);

    // Group by reason
    const basedOnSystems = sorted.filter((r) => topSystems.includes(r.system)).slice(0, 4);
    
    const basedOnSystemIds = new Set(basedOnSystems.map((r) => r.id));
    const basedOnGenres = sorted
      .filter((r) => {
        if (basedOnSystemIds.has(r.id)) return false;
        if (!r.genre) return false;
        const romGenres = r.genre.split(',').map((g) => g.trim());
        return romGenres.some((g) => topGenres.includes(g));
      })
      .slice(0, 4);

    const usedIds = new Set([...basedOnSystems, ...basedOnGenres].map((r) => r.id));
    const popular = sorted.filter((r) => !usedIds.has(r.id)).slice(0, 4);

    res.json({
      recommendations: {
        basedOnSystems: {
          reason: topSystems[0] ? `Because you play ${topSystems[0]} games` : 'Popular games',
          games: basedOnSystems,
        },
        basedOnGenres: {
          reason: topGenres[0] ? `Because you like ${topGenres[0]} games` : 'Recommended for you',
          games: basedOnGenres,
        },
        popular: {
          reason: 'Popular with other players',
          games: popular,
        },
      },
      preferences: {
        topSystems,
        topGenres,
      },
    });
  } catch (error: any) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Get leaderboards
router.get('/leaderboards', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type = 'playtime' } = req.query;

    let leaderboard: any[] = [];

    if (type === 'playtime') {
      const playtimeData = await prisma.playTime.groupBy({
        by: ['userId'],
        _sum: { minutes: true },
        orderBy: { _sum: { minutes: 'desc' } },
        take: 50,
      });

      leaderboard = await Promise.all(
        playtimeData.map(async (pt, index) => {
          const user = await prisma.user.findUnique({
            where: { id: pt.userId },
            select: { id: true, username: true, avatar: true },
          });
          return {
            rank: index + 1,
            user,
            value: pt._sum.minutes || 0,
            formattedValue: `${Math.round((pt._sum.minutes || 0) / 60)} hours`,
          };
        })
      );
    } else if (type === 'achievements') {
      const achievementData = await prisma.userAchievement.groupBy({
        by: ['userId'],
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 50,
      });

      leaderboard = await Promise.all(
        achievementData.map(async (ad, index) => {
          const user = await prisma.user.findUnique({
            where: { id: ad.userId },
            select: { id: true, username: true, avatar: true },
          });
          return {
            rank: index + 1,
            user,
            value: ad._count,
            formattedValue: `${ad._count} achievements`,
          };
        })
      );
    } else if (type === 'games') {
      const gamesData = await prisma.playTime.groupBy({
        by: ['userId'],
        _count: { romId: true },
        orderBy: { _count: { romId: 'desc' } },
        take: 50,
      });

      leaderboard = await Promise.all(
        gamesData.map(async (gd, index) => {
          const user = await prisma.user.findUnique({
            where: { id: gd.userId },
            select: { id: true, username: true, avatar: true },
          });
          return {
            rank: index + 1,
            user,
            value: gd._count.romId,
            formattedValue: `${gd._count.romId} games`,
          };
        })
      );
    }

    res.json({ type, leaderboard });
  } catch (error: any) {
    console.error('Leaderboards error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboards' });
  }
});

// Record playtime
router.post('/record', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { romId, minutes } = req.body;

    if (!romId || !minutes || minutes < 0) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.playTime.upsert({
      where: {
        userId_romId_date: {
          userId,
          romId,
          date: today,
        },
      },
      update: {
        minutes: { increment: minutes },
      },
      create: {
        userId,
        romId,
        date: today,
        minutes,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Record playtime error:', error);
    res.status(500).json({ error: 'Failed to record playtime' });
  }
});

export default router;
