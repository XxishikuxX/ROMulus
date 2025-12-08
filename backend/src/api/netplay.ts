import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { getSocketIO, emitToUser } from '../services/socket';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Netplay session types
type NetplayMode = 'ggpo' | 'lockstep' | 'spectate';

interface NetplaySession {
  id: string;
  hostId: string;
  romId: string;
  mode: NetplayMode;
  maxPlayers: number;
  players: NetplayPlayer[];
  spectators: string[];
  status: 'waiting' | 'starting' | 'active' | 'paused' | 'ended';
  settings: NetplaySettings;
  relayServer?: string;
  createdAt: Date;
}

interface NetplayPlayer {
  userId: string;
  username: string;
  playerNum: number;
  latency: number;
  status: 'connected' | 'ready' | 'playing' | 'disconnected';
  inputDelay: number;
}

interface NetplaySettings {
  inputDelay: number;
  rollbackFrames: number;
  checkFrames: number;
  useRelay: boolean;
  allowSpectators: boolean;
  pauseOnDisconnect: boolean;
  desyncRecovery: boolean;
}

// Default netplay settings
const DEFAULT_NETPLAY_SETTINGS: NetplaySettings = {
  inputDelay: 0,
  rollbackFrames: 7, // GGPO-style rollback
  checkFrames: 120, // Sync check interval
  useRelay: true, // Use MITM relay for NAT traversal
  allowSpectators: true,
  pauseOnDisconnect: true,
  desyncRecovery: true,
};

// In-memory session storage (use Redis in production)
const activeSessions = new Map<string, NetplaySession>();

// System netplay compatibility
const NETPLAY_COMPATIBILITY: Record<string, { supported: boolean; maxPlayers: number; rollback: boolean }> = {
  NES: { supported: true, maxPlayers: 4, rollback: true },
  SNES: { supported: true, maxPlayers: 5, rollback: true },
  N64: { supported: true, maxPlayers: 4, rollback: false }, // Too intensive for rollback
  GB: { supported: true, maxPlayers: 2, rollback: true },
  GBC: { supported: true, maxPlayers: 2, rollback: true },
  GBA: { supported: true, maxPlayers: 4, rollback: true },
  GENESIS: { supported: true, maxPlayers: 4, rollback: true },
  MASTER_SYSTEM: { supported: true, maxPlayers: 2, rollback: true },
  GAME_GEAR: { supported: true, maxPlayers: 2, rollback: true },
  PS1: { supported: true, maxPlayers: 4, rollback: false },
  DREAMCAST: { supported: true, maxPlayers: 4, rollback: false },
  SATURN: { supported: true, maxPlayers: 6, rollback: false },
  GAMECUBE: { supported: true, maxPlayers: 4, rollback: false },
  WII: { supported: false, maxPlayers: 0, rollback: false },
  PS2: { supported: false, maxPlayers: 0, rollback: false },
  NDS: { supported: true, maxPlayers: 2, rollback: true },
  ARCADE: { supported: true, maxPlayers: 4, rollback: true },
};

// Get netplay compatibility for a system
router.get('/compatibility/:system', authMiddleware, async (req: any, res) => {
  try {
    const { system } = req.params;
    const compat = NETPLAY_COMPATIBILITY[system] || { supported: false, maxPlayers: 0, rollback: false };
    res.json(compat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get compatibility' });
  }
});

// Create netplay session
router.post('/sessions', authMiddleware, async (req: any, res) => {
  try {
    const { romId, mode = 'ggpo', maxPlayers = 2, settings = {} } = req.body;
    const userId = req.user.id;

    // Verify ROM exists and get system
    const rom = await prisma.rom.findUnique({ where: { id: romId } });
    if (!rom) {
      return res.status(404).json({ error: 'ROM not found' });
    }

    // Check system compatibility
    const compat = NETPLAY_COMPATIBILITY[rom.system];
    if (!compat?.supported) {
      return res.status(400).json({ error: 'System does not support netplay' });
    }

    // Check if user already has an active session
    const existingSession = Array.from(activeSessions.values()).find(
      s => s.hostId === userId && s.status !== 'ended'
    );
    if (existingSession) {
      return res.status(400).json({ 
        error: 'You already have an active session',
        sessionId: existingSession.id,
      });
    }

    // Create session
    const sessionId = crypto.randomBytes(8).toString('hex');
    const mergedSettings: NetplaySettings = { ...DEFAULT_NETPLAY_SETTINGS, ...settings };

    // Disable rollback for incompatible systems
    if (!compat.rollback && mode === 'ggpo') {
      mergedSettings.rollbackFrames = 0;
    }

    const session: NetplaySession = {
      id: sessionId,
      hostId: userId,
      romId,
      mode: mode as NetplayMode,
      maxPlayers: Math.min(maxPlayers, compat.maxPlayers),
      players: [{
        userId,
        username: req.user.username,
        playerNum: 1,
        latency: 0,
        status: 'connected',
        inputDelay: mergedSettings.inputDelay,
      }],
      spectators: [],
      status: 'waiting',
      settings: mergedSettings,
      createdAt: new Date(),
    };

    activeSessions.set(sessionId, session);

    // Store in database for persistence
    await prisma.netplaySession.create({
      data: {
        id: sessionId,
        hostId: userId,
        romId,
        mode,
        maxPlayers: session.maxPlayers,
        settings: mergedSettings as any,
        status: 'waiting',
      },
    });

    res.json({ session: sanitizeSession(session) });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get available sessions
router.get('/sessions', authMiddleware, async (req: any, res) => {
  try {
    const { system, status = 'waiting' } = req.query;

    let sessions = Array.from(activeSessions.values());

    // Filter by status
    sessions = sessions.filter(s => s.status === status);

    // Filter by system if provided
    if (system) {
      const roms = await prisma.rom.findMany({
        where: { 
          id: { in: sessions.map(s => s.romId) },
          system: system as any,
        },
        select: { id: true },
      });
      const romIds = new Set(roms.map(r => r.id));
      sessions = sessions.filter(s => romIds.has(s.romId));
    }

    // Add ROM info
    const romIds = [...new Set(sessions.map(s => s.romId))];
    const roms = await prisma.rom.findMany({
      where: { id: { in: romIds } },
      select: { id: true, title: true, system: true, coverArt: true },
    });
    const romMap = new Map(roms.map(r => [r.id, r]));

    res.json({
      sessions: sessions.map(s => ({
        ...sanitizeSession(s),
        rom: romMap.get(s.romId),
      })),
    });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Get session details
router.get('/sessions/:sessionId', authMiddleware, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const rom = await prisma.rom.findUnique({
      where: { id: session.romId },
      select: { id: true, title: true, system: true, coverArt: true },
    });

    res.json({
      session: sanitizeSession(session),
      rom,
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Join session
router.post('/sessions/:sessionId/join', authMiddleware, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const { asSpectator = false } = req.body;
    const userId = req.user.id;

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'waiting') {
      return res.status(400).json({ error: 'Session is not accepting players' });
    }

    // Check if already in session
    const isPlayer = session.players.some(p => p.userId === userId);
    const isSpectator = session.spectators.includes(userId);

    if (isPlayer || isSpectator) {
      return res.status(400).json({ error: 'Already in session' });
    }

    if (asSpectator) {
      if (!session.settings.allowSpectators) {
        return res.status(400).json({ error: 'Spectators not allowed' });
      }
      session.spectators.push(userId);
    } else {
      if (session.players.length >= session.maxPlayers) {
        return res.status(400).json({ error: 'Session is full' });
      }

      session.players.push({
        userId,
        username: req.user.username,
        playerNum: session.players.length + 1,
        latency: 0,
        status: 'connected',
        inputDelay: session.settings.inputDelay,
      });
    }

    // Notify host and other players
    const io = getSocketIO();
    session.players.forEach(p => {
      emitToUser(p.userId, 'netplay:player_joined', {
        sessionId,
        player: {
          userId,
          username: req.user.username,
          playerNum: session.players.length,
          asSpectator,
        },
      });
    });

    res.json({ session: sanitizeSession(session) });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// Leave session
router.post('/sessions/:sessionId/leave', authMiddleware, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const playerIndex = session.players.findIndex(p => p.userId === userId);
    const spectatorIndex = session.spectators.indexOf(userId);

    if (playerIndex === -1 && spectatorIndex === -1) {
      return res.status(400).json({ error: 'Not in session' });
    }

    // If host leaves, end session
    if (session.hostId === userId) {
      session.status = 'ended';
      
      // Notify all participants
      [...session.players, ...session.spectators.map(id => ({ userId: id }))].forEach(p => {
        emitToUser(p.userId, 'netplay:session_ended', {
          sessionId,
          reason: 'Host left',
        });
      });

      activeSessions.delete(sessionId);
    } else {
      if (playerIndex !== -1) {
        session.players.splice(playerIndex, 1);
        // Renumber remaining players
        session.players.forEach((p, i) => { p.playerNum = i + 1; });
      } else {
        session.spectators.splice(spectatorIndex, 1);
      }

      // Notify remaining participants
      session.players.forEach(p => {
        emitToUser(p.userId, 'netplay:player_left', {
          sessionId,
          userId,
        });
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Leave session error:', error);
    res.status(500).json({ error: 'Failed to leave session' });
  }
});

// Set player ready
router.post('/sessions/:sessionId/ready', authMiddleware, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const { ready = true } = req.body;
    const userId = req.user.id;

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const player = session.players.find(p => p.userId === userId);
    if (!player) {
      return res.status(400).json({ error: 'Not a player in this session' });
    }

    player.status = ready ? 'ready' : 'connected';

    // Notify others
    session.players.forEach(p => {
      emitToUser(p.userId, 'netplay:player_ready', {
        sessionId,
        userId,
        ready,
      });
    });

    // Check if all players ready
    const allReady = session.players.every(p => p.status === 'ready');
    
    res.json({ 
      session: sanitizeSession(session),
      allReady,
    });
  } catch (error) {
    console.error('Ready error:', error);
    res.status(500).json({ error: 'Failed to set ready status' });
  }
});

// Start game (host only)
router.post('/sessions/:sessionId/start', authMiddleware, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.hostId !== userId) {
      return res.status(403).json({ error: 'Only host can start game' });
    }

    if (session.players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players' });
    }

    // Check if all players ready
    const allReady = session.players.every(p => p.status === 'ready' || p.userId === userId);
    if (!allReady) {
      return res.status(400).json({ error: 'Not all players are ready' });
    }

    session.status = 'starting';

    // Calculate optimal input delay based on latencies
    const maxLatency = Math.max(...session.players.map(p => p.latency));
    const recommendedDelay = Math.ceil(maxLatency / 16.67); // frames at 60fps

    // Notify all players to start
    session.players.forEach(p => {
      emitToUser(p.userId, 'netplay:game_starting', {
        sessionId,
        countdown: 3,
        playerNum: p.playerNum,
        settings: {
          ...session.settings,
          recommendedInputDelay: recommendedDelay,
        },
      });
    });

    // Notify spectators
    session.spectators.forEach(id => {
      emitToUser(id, 'netplay:game_starting', {
        sessionId,
        isSpectator: true,
      });
    });

    // After countdown, mark as active
    setTimeout(() => {
      if (activeSessions.has(sessionId)) {
        const s = activeSessions.get(sessionId)!;
        s.status = 'active';
        s.players.forEach(p => { p.status = 'playing'; });
      }
    }, 3000);

    res.json({ session: sanitizeSession(session) });
  } catch (error) {
    console.error('Start error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Report latency (ping)
router.post('/sessions/:sessionId/ping', authMiddleware, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const { latency } = req.body;
    const userId = req.user.id;

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const player = session.players.find(p => p.userId === userId);
    if (player) {
      player.latency = latency;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to report latency' });
  }
});

// End session (host only)
router.post('/sessions/:sessionId/end', authMiddleware, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.hostId !== userId) {
      return res.status(403).json({ error: 'Only host can end session' });
    }

    session.status = 'ended';

    // Notify all participants
    [...session.players, ...session.spectators.map(id => ({ userId: id }))].forEach((p: any) => {
      emitToUser(p.userId, 'netplay:session_ended', {
        sessionId,
        reason: 'Host ended session',
      });
    });

    // Update database
    await prisma.netplaySession.update({
      where: { id: sessionId },
      data: { status: 'ended', endedAt: new Date() },
    });

    activeSessions.delete(sessionId);

    res.json({ success: true });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get relay servers
router.get('/relay-servers', authMiddleware, async (req: any, res) => {
  try {
    // In production, these would be actual relay servers
    const servers = [
      { id: 'us-east', name: 'US East', region: 'us-east-1', latency: null },
      { id: 'us-west', name: 'US West', region: 'us-west-2', latency: null },
      { id: 'eu-west', name: 'EU West', region: 'eu-west-1', latency: null },
      { id: 'asia', name: 'Asia Pacific', region: 'ap-northeast-1', latency: null },
    ];

    res.json({ servers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get relay servers' });
  }
});

// Helper to sanitize session for response (remove sensitive data)
function sanitizeSession(session: NetplaySession) {
  return {
    id: session.id,
    hostId: session.hostId,
    romId: session.romId,
    mode: session.mode,
    maxPlayers: session.maxPlayers,
    players: session.players.map(p => ({
      userId: p.userId,
      username: p.username,
      playerNum: p.playerNum,
      status: p.status,
      latency: p.latency,
    })),
    spectatorCount: session.spectators.length,
    status: session.status,
    settings: {
      allowSpectators: session.settings.allowSpectators,
      useRelay: session.settings.useRelay,
    },
    createdAt: session.createdAt,
  };
}

export default router;
export { NETPLAY_COMPATIBILITY, DEFAULT_NETPLAY_SETTINGS };
