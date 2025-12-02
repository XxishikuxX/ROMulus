import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// RetroAchievements API Configuration
const RA_API_URL = 'https://retroachievements.org/API';

interface RAGameInfo {
  ID: number;
  Title: string;
  ConsoleID: number;
  ConsoleName: string;
  ImageIcon: string;
  ImageTitle: string;
  ImageIngame: string;
  ImageBoxArt: string;
  Publisher: string;
  Developer: string;
  Genre: string;
  Released: string;
  NumAchievements: number;
  NumDistinctPlayersCasual: number;
  NumDistinctPlayersHardcore: number;
}

interface RAAchievement {
  ID: number;
  NumAwarded: number;
  NumAwardedHardcore: number;
  Title: string;
  Description: string;
  Points: number;
  TrueRatio: number;
  Author: string;
  DateModified: string;
  DateCreated: string;
  BadgeName: string;
  DisplayOrder: number;
  MemAddr: string;
}

interface RAUserProgress {
  NumPossibleAchievements: number;
  PossibleScore: number;
  NumAchieved: number;
  ScoreAchieved: number;
  NumAchievedHardcore: number;
  ScoreAchievedHardcore: number;
  Achievements: Record<string, {
    ID: number;
    Title: string;
    Description: string;
    Points: number;
    BadgeName: string;
    DateEarned?: string;
    DateEarnedHardcore?: string;
  }>;
}

// Helper to make RA API calls
async function raApiCall(endpoint: string, params: Record<string, string>, apiKey: string) {
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
  // Different systems use different hashing methods
  // This is a simplified version - actual implementation varies by system
  const hashMethods: Record<string, (buf: Buffer) => string> = {
    NES: (buf) => {
      // Skip 16-byte iNES header if present
      const data = buf[0] === 0x4E && buf[1] === 0x45 && buf[2] === 0x53 && buf[3] === 0x1A
        ? buf.slice(16)
        : buf;
      return crypto.createHash('md5').update(data).digest('hex');
    },
    SNES: (buf) => {
      // Check for SMC header (512 bytes) and skip if present
      const data = buf.length % 1024 === 512 ? buf.slice(512) : buf;
      return crypto.createHash('md5').update(data).digest('hex');
    },
    GB: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    GBC: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    GBA: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    N64: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    GENESIS: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
    PS1: (buf) => {
      // PS1 uses serial number extraction - simplified here
      return crypto.createHash('md5').update(buf.slice(0, 2048)).digest('hex');
    },
    default: (buf) => crypto.createHash('md5').update(buf).digest('hex'),
  };

  const hashFn = hashMethods[system] || hashMethods.default;
  return hashFn(romBuffer);
}

// RA System ID mapping
const systemToRAConsoleId: Record<string, number> = {
  NES: 7,
  SNES: 3,
  N64: 2,
  GB: 4,
  GBC: 6,
  GBA: 5,
  GENESIS: 1,
  MASTER_SYSTEM: 11,
  GAME_GEAR: 15,
  SATURN: 39,
  DREAMCAST: 40,
  PS1: 12,
  PS2: 21,
  PSP: 41,
  GAMECUBE: 16,
  WII: 19,
  NDS: 18,
  ARCADE: 27,
  ATARI_2600: 25,
  ATARI_7800: 51,
  LYNX: 13,
  NEO_GEO: 14,
  PC_ENGINE: 8,
  WONDERSWAN: 53,
  VIRTUAL_BOY: 28,
};

// Link RetroAchievements account
router.post('/link', authMiddleware, async (req: any, res) => {
  try {
    const { username, apiKey } = req.body;
    const userId = req.user.id;

    if (!username || !apiKey) {
      return res.status(400).json({ error: 'Username and API key required' });
    }

    // Verify credentials with RA API
    try {
      const profile = await raApiCall('API_GetUserProfile.php', { 
        username,
        u: username 
      }, apiKey);

      if (!profile || profile.ID === undefined) {
        return res.status(401).json({ error: 'Invalid RetroAchievements credentials' });
      }

      // Store credentials (encrypted in production)
      await prisma.user.update({
        where: { id: userId },
        data: {
          raUsername: username,
          raApiKey: apiKey, // Should be encrypted
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
    } catch (error) {
      return res.status(401).json({ error: 'Failed to verify RetroAchievements account' });
    }
  } catch (error) {
    console.error('RA link error:', error);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

// Unlink RetroAchievements account
router.post('/unlink', authMiddleware, async (req: any, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        raUsername: null,
        raApiKey: null,
        raUserId: null,
        raLinkedAt: null,
      },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

// Get RA profile
router.get('/profile', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { raUsername: true, raApiKey: true, raUserId: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(404).json({ error: 'RetroAchievements not linked' });
    }

    const profile = await raApiCall('API_GetUserProfile.php', {
      username: user.raUsername,
      u: user.raUsername,
    }, user.raApiKey);

    const recentAchievements = await raApiCall('API_GetUserRecentAchievements.php', {
      username: user.raUsername,
      u: user.raUsername,
      c: '10',
    }, user.raApiKey);

    res.json({
      profile: {
        username: profile.User,
        points: profile.TotalPoints,
        softcorePoints: profile.TotalSoftcorePoints,
        rank: profile.Rank,
        motto: profile.Motto,
        userPic: `https://retroachievements.org${profile.UserPic}`,
        memberSince: profile.MemberSince,
        richPresence: profile.RichPresenceMsg,
        lastGame: profile.LastGameID ? {
          id: profile.LastGameID,
          title: profile.LastGame?.Title,
        } : null,
      },
      recentAchievements: recentAchievements?.map((a: any) => ({
        id: a.AchievementID,
        title: a.Title,
        description: a.Description,
        points: a.Points,
        badgeUrl: `https://media.retroachievements.org/Badge/${a.BadgeName}.png`,
        gameTitle: a.GameTitle,
        gameId: a.GameID,
        dateEarned: a.Date,
        hardcore: a.HardcoreMode === 1,
      })) || [],
    });
  } catch (error) {
    console.error('RA profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get achievements for a game
router.get('/game/:gameId', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(404).json({ error: 'RetroAchievements not linked' });
    }

    const { gameId } = req.params;

    // Get game info and achievements
    const gameInfo = await raApiCall('API_GetGameExtended.php', {
      username: user.raUsername,
      i: gameId,
    }, user.raApiKey);

    // Get user progress for this game
    const progress = await raApiCall('API_GetGameInfoAndUserProgress.php', {
      username: user.raUsername,
      u: user.raUsername,
      g: gameId,
    }, user.raApiKey);

    const achievements = Object.values(progress.Achievements || {}).map((a: any) => ({
      id: a.ID,
      title: a.Title,
      description: a.Description,
      points: a.Points,
      trueRatio: a.TrueRatio,
      badgeUrl: `https://media.retroachievements.org/Badge/${a.BadgeName}.png`,
      badgeLockedUrl: `https://media.retroachievements.org/Badge/${a.BadgeName}_lock.png`,
      author: a.Author,
      dateEarned: a.DateEarned || null,
      dateEarnedHardcore: a.DateEarnedHardcore || null,
      isEarned: !!a.DateEarned,
      isEarnedHardcore: !!a.DateEarnedHardcore,
      displayOrder: a.DisplayOrder,
    }));

    res.json({
      game: {
        id: gameInfo.ID,
        title: gameInfo.Title,
        consoleName: gameInfo.ConsoleName,
        imageIcon: `https://media.retroachievements.org${gameInfo.ImageIcon}`,
        imageTitle: `https://media.retroachievements.org${gameInfo.ImageTitle}`,
        imageIngame: `https://media.retroachievements.org${gameInfo.ImageIngame}`,
        imageBoxArt: `https://media.retroachievements.org${gameInfo.ImageBoxArt}`,
        developer: gameInfo.Developer,
        publisher: gameInfo.Publisher,
        genre: gameInfo.Genre,
        released: gameInfo.Released,
      },
      progress: {
        numAchievements: progress.NumPossibleAchievements,
        numEarned: progress.NumAchieved,
        numEarnedHardcore: progress.NumAchievedHardcore,
        possibleScore: progress.PossibleScore,
        earnedScore: progress.ScoreAchieved,
        earnedScoreHardcore: progress.ScoreAchievedHardcore,
        completionPercentage: progress.NumPossibleAchievements > 0
          ? Math.round((progress.NumAchieved / progress.NumPossibleAchievements) * 100)
          : 0,
      },
      achievements: achievements.sort((a: any, b: any) => a.displayOrder - b.displayOrder),
    });
  } catch (error) {
    console.error('RA game error:', error);
    res.status(500).json({ error: 'Failed to fetch game achievements' });
  }
});

// Lookup game by hash
router.post('/lookup', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(404).json({ error: 'RetroAchievements not linked' });
    }

    const { hash, system } = req.body;

    if (!hash) {
      return res.status(400).json({ error: 'ROM hash required' });
    }

    // Look up game by hash
    const result = await raApiCall('API_GetGameInfoByHash.php', {
      username: user.raUsername,
      m: hash,
    }, user.raApiKey);

    if (!result || !result.ID) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      game: {
        id: result.ID,
        title: result.Title,
        consoleName: result.ConsoleName,
        imageIcon: `https://media.retroachievements.org${result.ImageIcon}`,
      },
    });
  } catch (error) {
    console.error('RA lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup game' });
  }
});

// Award achievement (called from emulator)
router.post('/award', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(404).json({ error: 'RetroAchievements not linked' });
    }

    const { achievementId, hardcore } = req.body;

    // Note: Actually awarding achievements requires the rcheevos library
    // integrated into the emulator core. This endpoint is for tracking
    // achievements that were awarded during gameplay.
    
    // Store local record
    await prisma.userRAchievement.create({
      data: {
        userId: req.user.id,
        achievementId: achievementId.toString(),
        hardcore: hardcore || false,
        earnedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('RA award error:', error);
    res.status(500).json({ error: 'Failed to record achievement' });
  }
});

// Get user's completed games
router.get('/completed', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(404).json({ error: 'RetroAchievements not linked' });
    }

    const completedGames = await raApiCall('API_GetUserCompletedGames.php', {
      username: user.raUsername,
      u: user.raUsername,
    }, user.raApiKey);

    res.json({
      games: completedGames?.map((g: any) => ({
        id: g.GameID,
        title: g.Title,
        consoleName: g.ConsoleName,
        imageIcon: `https://media.retroachievements.org${g.ImageIcon}`,
        maxPossible: g.MaxPossible,
        numAwarded: g.NumAwarded,
        pctWon: g.PctWon,
        hardcoreMode: g.HardcoreMode,
      })) || [],
    });
  } catch (error) {
    console.error('RA completed error:', error);
    res.status(500).json({ error: 'Failed to fetch completed games' });
  }
});

// Get leaderboards for a game
router.get('/leaderboards/:gameId', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(404).json({ error: 'RetroAchievements not linked' });
    }

    const { gameId } = req.params;

    const leaderboards = await raApiCall('API_GetGameLeaderboards.php', {
      username: user.raUsername,
      i: gameId,
    }, user.raApiKey);

    res.json({
      leaderboards: leaderboards?.map((lb: any) => ({
        id: lb.ID,
        title: lb.Title,
        description: lb.Description,
        format: lb.Format,
        numResults: lb.NumResults,
      })) || [],
    });
  } catch (error) {
    console.error('RA leaderboards error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboards' });
  }
});

// Search RA games
router.get('/search', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { raUsername: true, raApiKey: true },
    });

    if (!user?.raUsername || !user?.raApiKey) {
      return res.status(404).json({ error: 'RetroAchievements not linked' });
    }

    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Note: RA doesn't have a direct search API, so we'd need to use
    // their game list endpoint with filtering
    // For now, return empty results
    res.json({ games: [] });
  } catch (error) {
    console.error('RA search error:', error);
    res.status(500).json({ error: 'Failed to search games' });
  }
});

export default router;
export { calculateRAHash, systemToRAConsoleId };
