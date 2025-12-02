import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { param, body, validationResult } from 'express-validator';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { getRedisClient } from '../services/redis';
import { emitToUser } from '../services/socket';

const router = Router();
const prisma = new PrismaClient();

// Active sessions map
const activeSessions: Map<string, {
  process: ChildProcess;
  userId: string;
  romId: string;
  startedAt: Date;
}> = new Map();

// Emulator configurations
const EMULATOR_CONFIG: Record<string, {
  command: string;
  args: (romPath: string, options?: any) => string[];
  requiresBios?: boolean;
}> = {
  PS3: {
    command: '/opt/romulus/emulators/rpcs3/rpcs3.AppImage',
    args: (romPath) => ['--no-gui', romPath],
    requiresBios: true
  },
  PS2: {
    command: 'pcsx2',
    args: (romPath) => ['--nogui', '--fullscreen', romPath],
    requiresBios: true
  },
  PS1: {
    command: '/opt/romulus/emulators/duckstation/DuckStation.AppImage',
    args: (romPath) => ['-batch', '-fullscreen', romPath],
    requiresBios: true
  },
  PSP: {
    command: 'ppsspp',
    args: (romPath) => ['--fullscreen', romPath]
  },
  VITA: {
    command: '/opt/romulus/emulators/vita3k/Vita3K',
    args: (romPath) => ['-r', romPath]
  },
  XBOX: {
    command: 'xemu',
    args: (romPath) => ['-dvd_path', romPath],
    requiresBios: true
  },
  XBOX360: {
    command: 'wine',
    args: (romPath) => ['/opt/romulus/emulators/xenia/xenia.exe', romPath]
  },
  WIIU: {
    command: '/opt/romulus/emulators/cemu/Cemu',
    args: (romPath) => ['-g', romPath, '-f']
  },
  WII: {
    command: 'dolphin-emu',
    args: (romPath) => ['--batch', '--exec=' + romPath]
  },
  GAMECUBE: {
    command: 'dolphin-emu',
    args: (romPath) => ['--batch', '--exec=' + romPath]
  },
  N3DS: {
    command: '/opt/romulus/emulators/citra/citra-qt',
    args: (romPath) => [romPath],
    requiresBios: true
  },
  NDS: {
    command: 'melonds',
    args: (romPath) => [romPath],
    requiresBios: true
  },
  N64: {
    command: 'mupen64plus',
    args: (romPath) => ['--fullscreen', romPath]
  },
  SNES: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/snes9x_libretro.so', romPath]
  },
  NES: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/mesen_libretro.so', romPath]
  },
  GBA: {
    command: 'mgba-qt',
    args: (romPath) => ['-f', romPath]
  },
  GBC: {
    command: 'mgba-qt',
    args: (romPath) => ['-f', romPath]
  },
  GB: {
    command: 'mgba-qt',
    args: (romPath) => ['-f', romPath]
  },
  DREAMCAST: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/flycast_libretro.so', romPath],
    requiresBios: true
  },
  SATURN: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/mednafen_saturn_libretro.so', romPath],
    requiresBios: true
  },
  GENESIS: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/genesis_plus_gx_libretro.so', romPath]
  },
  SEGACD: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/genesis_plus_gx_libretro.so', romPath],
    requiresBios: true
  },
  S32X: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/picodrive_libretro.so', romPath]
  },
  SMS: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/genesis_plus_gx_libretro.so', romPath]
  },
  GAMEGEAR: {
    command: 'retroarch',
    args: (romPath) => ['-L', '/usr/lib/libretro/genesis_plus_gx_libretro.so', romPath]
  }
};

// Start a game session
router.post('/start',
  [
    body('romId').isUUID(),
    body('quality').optional().isIn(['720p', '1080p', '4k'])
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { romId, quality = '1080p' } = req.body;
      const userId = req.user!.id;

      // Check if user already has active session
      const existingSession = await prisma.gameSession.findFirst({
        where: { userId, isActive: true }
      });

      if (existingSession) {
        return res.status(400).json({ 
          error: 'You already have an active session',
          sessionId: existingSession.id
        });
      }

      // Get ROM
      const rom = await prisma.rom.findUnique({ where: { id: romId } });
      if (!rom) {
        return res.status(404).json({ error: 'ROM not found' });
      }

      // Check emulator config exists
      const emulator = EMULATOR_CONFIG[rom.system];
      if (!emulator) {
        return res.status(400).json({ error: `Unsupported system: ${rom.system}` });
      }

      // Check concurrent session limit
      const redis = getRedisClient();
      const activeSessions = await prisma.gameSession.count({
        where: { isActive: true }
      });
      
      const maxSessions = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10');
      if (activeSessions >= maxSessions) {
        return res.status(503).json({ error: 'Server at capacity, please try again later' });
      }

      // Create session record
      const session = await prisma.gameSession.create({
        data: {
          userId,
          romId,
          quality,
          isActive: true
        }
      });

      // Update library entry
      await prisma.userLibrary.upsert({
        where: {
          userId_romId: { userId, romId }
        },
        update: {
          lastPlayed: new Date(),
          playCount: { increment: 1 }
        },
        create: {
          userId,
          romId,
          lastPlayed: new Date(),
          playCount: 1
        }
      });

      // Start emulator process
      const env = {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ':99'
      };

      try {
        const emulatorProcess = spawn(
          emulator.command,
          emulator.args(rom.filepath),
          {
            env,
            detached: false,
            stdio: ['pipe', 'pipe', 'pipe']
          }
        );

        // Store active session
        activeSessions.set(session.id, {
          process: emulatorProcess,
          userId,
          romId,
          startedAt: new Date()
        });

        // Update session with process ID
        await prisma.gameSession.update({
          where: { id: session.id },
          data: { processId: emulatorProcess.pid }
        });

        // Handle process events
        emulatorProcess.on('exit', async (code) => {
          logger.info(`Session ${session.id} emulator exited with code ${code}`);
          await endSession(session.id);
        });

        emulatorProcess.on('error', async (err) => {
          logger.error(`Session ${session.id} emulator error:`, err);
          await endSession(session.id);
        });

        // Track session in Redis for streaming
        await redis.set(`session:${session.id}`, JSON.stringify({
          userId,
          romId,
          quality,
          pid: emulatorProcess.pid,
          startedAt: new Date().toISOString()
        }), 'EX', 86400); // 24 hour expiry

        logger.info(`Started session ${session.id} for user ${userId}, ROM: ${rom.title}`);

        res.json({
          sessionId: session.id,
          streamUrl: `/stream/${session.id}`,
          system: rom.system,
          title: rom.title
        });
      } catch (spawnError) {
        // Clean up failed session
        await prisma.gameSession.update({
          where: { id: session.id },
          data: { isActive: false, endedAt: new Date() }
        });
        throw spawnError;
      }
    } catch (error) {
      logger.error('Error starting session:', error);
      res.status(500).json({ error: 'Failed to start game session' });
    }
  }
);

// End a game session
router.post('/:sessionId/end',
  param('sessionId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Permission denied' });
      }

      await endSession(sessionId);

      res.json({ message: 'Session ended' });
    } catch (error) {
      logger.error('Error ending session:', error);
      res.status(500).json({ error: 'Failed to end session' });
    }
  }
);

// Get session info
router.get('/:sessionId',
  param('sessionId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          rom: {
            select: {
              title: true,
              system: true,
              coverArt: true
            }
          }
        }
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Permission denied' });
      }

      res.json(session);
    } catch (error) {
      logger.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }
);

// Get user's active session
router.get('/active/current', async (req: AuthRequest, res) => {
  try {
    const session = await prisma.gameSession.findFirst({
      where: {
        userId: req.user!.id,
        isActive: true
      },
      include: {
        rom: {
          select: {
            title: true,
            system: true,
            coverArt: true
          }
        }
      }
    });

    res.json(session || null);
  } catch (error) {
    logger.error('Error getting active session:', error);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});

// Save state
router.post('/:sessionId/save',
  [
    param('sessionId').isUUID(),
    body('slot').isInt({ min: 0, max: 9 })
  ],
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { slot } = req.body;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || !session.isActive) {
        return res.status(400).json({ error: 'No active session' });
      }

      if (session.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Generate save state filename
      const filename = `${session.romId}_slot${slot}.state`;
      const savePath = path.join(
        process.env.SAVES_PATH || '/opt/romulus/data/saves',
        req.user!.id,
        session.romId
      );

      // Trigger save state in emulator (implementation depends on emulator)
      // This is a placeholder - actual implementation would send signals to the emulator
      
      // Record save state in database
      const saveState = await prisma.saveState.upsert({
        where: {
          userId_romId_slot: {
            userId: req.user!.id,
            romId: session.romId,
            slot
          }
        },
        update: {
          filename,
          filepath: path.join(savePath, filename),
          updatedAt: new Date()
        },
        create: {
          userId: req.user!.id,
          romId: session.romId,
          slot,
          filename,
          filepath: path.join(savePath, filename)
        }
      });

      res.json(saveState);
    } catch (error) {
      logger.error('Error saving state:', error);
      res.status(500).json({ error: 'Failed to save state' });
    }
  }
);

// Load state
router.post('/:sessionId/load',
  [
    param('sessionId').isUUID(),
    body('slot').isInt({ min: 0, max: 9 })
  ],
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { slot } = req.body;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || !session.isActive) {
        return res.status(400).json({ error: 'No active session' });
      }

      const saveState = await prisma.saveState.findUnique({
        where: {
          userId_romId_slot: {
            userId: req.user!.id,
            romId: session.romId,
            slot
          }
        }
      });

      if (!saveState) {
        return res.status(404).json({ error: 'No save state in this slot' });
      }

      // Trigger load state in emulator
      // Placeholder for actual implementation

      res.json({ message: 'State loaded', saveState });
    } catch (error) {
      logger.error('Error loading state:', error);
      res.status(500).json({ error: 'Failed to load state' });
    }
  }
);

// Helper function to end session
async function endSession(sessionId: string) {
  const activeSession = activeSessions.get(sessionId);
  
  if (activeSession) {
    // Kill the emulator process
    try {
      activeSession.process.kill('SIGTERM');
    } catch (e) {
      logger.warn(`Failed to kill process for session ${sessionId}`);
    }
    activeSessions.delete(sessionId);
  }

  // Update database
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (session && session.isActive) {
    const duration = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
    
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
        duration
      }
    });

    // Update play time statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.playTime.upsert({
      where: {
        userId_romId_date: {
          userId: session.userId,
          romId: session.romId,
          date: today
        }
      },
      update: {
        minutes: { increment: Math.floor(duration / 60) }
      },
      create: {
        userId: session.userId,
        romId: session.romId,
        date: today,
        minutes: Math.floor(duration / 60)
      }
    });

    // Clear from Redis
    const redis = getRedisClient();
    await redis.del(`session:${sessionId}`);

    // Notify user
    emitToUser(session.userId, 'session:ended', { sessionId, duration });
  }
}

export default router;
