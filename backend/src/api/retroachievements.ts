import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// RetroAchievements API Configuration
const RA_API_URL = 'https://retroachievements.org/API';

// Helper to make RA API calls
async function raApiCall(endpoint: string, params: Record<string, string>, apiKey: string): Promise<any> {
  const url = new URL(`${RA_API_URL}/${endpoint}`);
  url.searchParams.set('z', params.username || '');
  url.searchParams.set('y', apiKey);
  
  Object.entries(params).forEach(([key, value]) => {
    if (key !== 'username') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`RA API error: ${response.status}`);
  }
  return response.json();
}

// Calculate game hash for RetroAchievements
function calculateRAHash(romBuffer: Buffer, system: string): string {
  const hashMethods: Record<string, (buf: Buffer) => string> = {
    NES: (buf) => {
      const data = buf[0] === 0x4E && buf[1] === 0x45 && buf[2] === 0x53 && buf[3] === 0x1A
        ? buf.slice(16)
        : buf;
      return crypto.createHash('md5').update(data).digest('hex');
    },
    SNES: (buf) => {
      const data = buf.length % 1024 === 512 ? buf.slice(512) : buf;
      return crypto.createHash('md5').update(data).digest('hex');
    },
    GB: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    GBC: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    GBA: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    N64: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    GENESIS: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    PS1: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    DEFAULT: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
  };

  const hashFn = hashMethods[system] || hashMethods.DEFAULT;
  return hashFn(romBuffer);
}

// Link RetroAchievements account
router.post('/link', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { raUsername, raApiKey } = req.body;
    const userId = req.user!.id;

    if (!raUsername || !raApiKey) {
      return res.status(400).json({ error: 'Username and API key required' });
    }

    const profile: any = await raApiCall('API_GetUserSummary.php', {
      username: raUsername,
      u: raUsername,
    }, raApiKey);

    if (!profile || profile.ID === undefined) {
      return res.status(401).json({ error: 'Invalid RetroAchievements credentials' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        raUsername,
        raApiKey,
        raUserId: profile.ID.toString(),
        raLinkedAt: new Date(),
      },
    });

    res.json({
      success: true,
      profile: {
        username: profile.User,
        points: profile.TotalPoints,
        rank: profile.Rank,
        motto: profile.Motto,
        userPic: `https://retroachievements.org${profile.UserPic}`,
      },
    });
  } catch (error: any) {
    console.error('RA link error:', error);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

// Unlink RetroAchievements account
router.post('/unlink', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        raUsername: null,
        raApiKey: null,
        raUserId: null,
        raLinkedAt: null,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('RA unlink error:', error);
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

// Get linked account status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        raUsername: true,
        raUserId: true,
        raLinkedAt: true,
        raApiKey: true,
      },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.json({ linked: false });
    }

    const profile: any = await raApiCall('API_GetUserSummary.php', {
      username: user.raUsername,
      u: user.raUsername,
    }, user.raApiKey);

    const recentAchievements: any = await raApiCall('API_GetUserRecentAchievements.php', {
      username: user.raUsername,
      u: user.raUsername,
      c: '10',
    }, user.raApiKey);

    res.json({
      linked: true,
      linkedAt: user.raLinkedAt,
      profile: {
        username: profile?.User,
        points: profile?.TotalPoints,
        softcorePoints: profile?.TotalSoftcorePoints,
        rank: profile?.Rank,
        motto: profile?.Motto,
        userPic: profile?.UserPic ? `https://retroachievements.org${profile.UserPic}` : null,
        memberSince: profile?.MemberSince,
        richPresence: profile?.RichPresenceMsg,
        lastGame: profile?.LastGameID ? {
          id: profile.LastGameID,
          title: profile.LastGame?.Title,
        } : null,
      },
      recentAchievements: Array.isArray(recentAchievements) ? recentAchievements.map((a: any) => ({
        id: a.AchievementID,
        title: a.Title,
        description: a.Description,
        points: a.Points,
        badgeUrl: `https://media.retroachievements.org/Badge/${a.BadgeName}.png`,
        gameTitle: a.GameTitle,
        earnedAt: a.Date,
        hardcore: a.HardcoreMode === 1,
      })) : [],
    });
  } catch (error: any) {
    console.error('RA status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Get game achievements and user progress
router.get('/game/:gameId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(400).json({ error: 'RetroAchievements not linked' });
    }

    const [gameInfo, progress]: [any, any] = await Promise.all([
      raApiCall('API_GetGame.php', { i: gameId }, user.raApiKey),
      raApiCall('API_GetGameInfoAndUserProgress.php', {
        username: user.raUsername,
        u: user.raUsername,
        g: gameId,
      }, user.raApiKey),
    ]);

    const achievements = Object.values(progress?.Achievements || {}).map((a: any) => ({
      id: a.ID,
      title: a.Title,
      description: a.Description,
      points: a.Points,
      badgeUrl: `https://media.retroachievements.org/Badge/${a.BadgeName}.png`,
      badgeLockedUrl: `https://media.retroachievements.org/Badge/${a.BadgeName}_lock.png`,
      displayOrder: a.DisplayOrder,
      earned: !!a.DateEarned,
      earnedAt: a.DateEarned,
      earnedHardcore: !!a.DateEarnedHardcore,
      earnedHardcoreAt: a.DateEarnedHardcore,
    }));

    res.json({
      game: {
        id: gameInfo?.ID,
        title: gameInfo?.Title,
        consoleName: gameInfo?.ConsoleName,
        imageIcon: gameInfo?.ImageIcon ? `https://media.retroachievements.org${gameInfo.ImageIcon}` : null,
        imageTitle: gameInfo?.ImageTitle ? `https://media.retroachievements.org${gameInfo.ImageTitle}` : null,
        imageIngame: gameInfo?.ImageIngame ? `https://media.retroachievements.org${gameInfo.ImageIngame}` : null,
        imageBoxArt: gameInfo?.ImageBoxArt ? `https://media.retroachievements.org${gameInfo.ImageBoxArt}` : null,
        developer: gameInfo?.Developer,
        publisher: gameInfo?.Publisher,
        genre: gameInfo?.Genre,
        released: gameInfo?.Released,
      },
      progress: {
        numAchievements: progress?.NumPossibleAchievements,
        numEarned: progress?.NumAchieved,
        numEarnedHardcore: progress?.NumAchievedHardcore,
        possibleScore: progress?.PossibleScore,
        earnedScore: progress?.ScoreAchieved,
        earnedScoreHardcore: progress?.ScoreAchievedHardcore,
        completionPercentage: progress?.NumPossibleAchievements > 0
          ? Math.round((progress.NumAchieved / progress.NumPossibleAchievements) * 100)
          : 0,
      },
      achievements,
    });
  } catch (error: any) {
    console.error('RA game error:', error);
    res.status(500).json({ error: 'Failed to fetch game achievements' });
  }
});

// Search for a game by hash
router.get('/identify/:hash', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { hash } = req.params;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(400).json({ error: 'RetroAchievements not linked' });
    }

    const result: any = await raApiCall('API_GetGameInfoByHash.php', { m: hash }, user.raApiKey);

    if (!result || !result.ID) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      game: {
        id: result.ID,
        title: result.Title,
        consoleName: result.ConsoleName,
        imageIcon: result.ImageIcon ? `https://media.retroachievements.org${result.ImageIcon}` : null,
      },
    });
  } catch (error: any) {
    console.error('RA identify error:', error);
    res.status(500).json({ error: 'Failed to identify game' });
  }
});

// Award achievement
router.post('/award', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { achievementId, hardcore } = req.body;
    const userId = req.user!.id;

    await prisma.userRAchievement.upsert({
      where: {
        userId_achievementId_hardcore: {
          userId,
          achievementId: achievementId.toString(),
          hardcore: hardcore || false,
        },
      },
      update: { earnedAt: new Date() },
      create: {
        userId,
        achievementId: achievementId.toString(),
        hardcore: hardcore || false,
        earnedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('RA award error:', error);
    res.status(500).json({ error: 'Failed to award achievement' });
  }
});

// Get user's completed games
router.get('/completed', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(400).json({ error: 'RetroAchievements not linked' });
    }

    const completedGames: any = await raApiCall('API_GetUserCompletedGames.php', {
      username: user.raUsername,
      u: user.raUsername,
    }, user.raApiKey);

    res.json({
      games: Array.isArray(completedGames) ? completedGames.map((g: any) => ({
        id: g.GameID,
        title: g.Title,
        consoleName: g.ConsoleName,
        imageIcon: g.ImageIcon ? `https://media.retroachievements.org${g.ImageIcon}` : null,
        hardcoreMode: g.HardcoreMode === 1,
        numAwarded: g.NumAwarded,
        maxPossible: g.MaxPossible,
        pctWon: g.PctWon,
      })) : [],
    });
  } catch (error: any) {
    console.error('RA completed error:', error);
    res.status(500).json({ error: 'Failed to fetch completed games' });
  }
});

// Get leaderboards for a game
router.get('/leaderboards/:gameId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(400).json({ error: 'RetroAchievements not linked' });
    }

    const leaderboards: any = await raApiCall('API_GetGameLeaderboards.php', {
      i: gameId,
      c: '100',
    }, user.raApiKey);

    res.json({
      leaderboards: Array.isArray(leaderboards) ? leaderboards.map((lb: any) => ({
        id: lb.ID,
        title: lb.Title,
        description: lb.Description,
        format: lb.Format,
        topEntry: lb.TopEntry ? {
          user: lb.TopEntry.User,
          score: lb.TopEntry.Score,
          formattedScore: lb.TopEntry.FormattedScore,
        } : null,
      })) : [],
    });
  } catch (error: any) {
    console.error('RA leaderboards error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboards' });
  }
});

export default router;
