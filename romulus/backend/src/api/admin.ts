import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { param, query, body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();

// Admin check middleware
const adminOnly = (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.use(adminOnly);

// ==================== DASHBOARD ====================

// Get admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      userCount,
      romCount,
      activeSessions,
      totalPlaytime,
      recentUsers,
      recentUploads,
      systemStats
    ] = await Promise.all([
      prisma.user.count(),
      prisma.rom.count(),
      prisma.gameSession.count({ where: { isActive: true } }),
      prisma.playTime.aggregate({ _sum: { minutes: true } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, username: true, email: true, createdAt: true }
      }),
      prisma.rom.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, system: true, createdAt: true }
      }),
      prisma.rom.groupBy({
        by: ['system'],
        _count: true
      })
    ]);

    res.json({
      stats: {
        users: userCount,
        roms: romCount,
        activeSessions,
        totalPlaytimeHours: Math.floor((totalPlaytime._sum.minutes || 0) / 60)
      },
      recentUsers,
      recentUploads,
      romsBySystem: systemStats.map(s => ({
        system: s.system,
        count: s._count
      }))
    });
  } catch (error) {
    logger.error('Error getting dashboard:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ==================== USER MANAGEMENT ====================

// List users
router.get('/users',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString(),
    query('role').optional().isIn(['USER', 'MODERATOR', 'ADMIN']),
    query('status').optional().isIn(['active', 'banned', 'inactive'])
  ],
  async (req, res) => {
    try {
      const { page = 1, limit = 20, search, role, status } = req.query as any;

      const where: any = {};

      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (role) {
        where.role = role;
      }

      if (status) {
        switch (status) {
          case 'active':
            where.isActive = true;
            where.isBanned = false;
            break;
          case 'banned':
            where.isBanned = true;
            break;
          case 'inactive':
            where.isActive = false;
            break;
        }
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
            role: true,
            isActive: true,
            isBanned: true,
            banReason: true,
            createdAt: true,
            lastLoginAt: true,
            _count: {
              select: {
                sessions: true,
                uploads: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.user.count({ where })
      ]);

      res.json({
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error) {
      logger.error('Error listing users:', error);
      res.status(500).json({ error: 'Failed to list users' });
    }
  }
);

// Get user details
router.get('/users/:userId',
  param('userId').isUUID(),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          preferences: true,
          _count: {
            select: {
              sessions: true,
              saves: true,
              uploads: true,
              library: true,
              achievements: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get total playtime
      const playtime = await prisma.playTime.aggregate({
        where: { userId },
        _sum: { minutes: true }
      });

      // Get recent activity
      const recentSessions = await prisma.gameSession.findMany({
        where: { userId },
        include: { rom: { select: { title: true, system: true } } },
        orderBy: { startedAt: 'desc' },
        take: 10
      });

      // Remove password hash
      const { passwordHash, ...safeUser } = user;

      res.json({
        ...safeUser,
        totalPlaytimeMinutes: playtime._sum.minutes || 0,
        recentSessions
      });
    } catch (error) {
      logger.error('Error getting user details:', error);
      res.status(500).json({ error: 'Failed to get user details' });
    }
  }
);

// Create user
router.post('/users',
  [
    body('email').isEmail().normalizeEmail(),
    body('username').isLength({ min: 3, max: 30 }),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['USER', 'MODERATOR', 'ADMIN'])
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, username, password, role = 'USER' } = req.body;

      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] }
      });

      if (existing) {
        return res.status(400).json({ error: 'Email or username already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email,
          username,
          passwordHash,
          role,
          preferences: { create: {} }
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true
        }
      });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_CREATE_USER',
        entity: 'User',
        entityId: user.id,
        details: { email, username, role },
        ipAddress: req.ip
      });

      res.status(201).json(user);
    } catch (error) {
      logger.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// Update user
router.patch('/users/:userId',
  [
    param('userId').isUUID(),
    body('email').optional().isEmail(),
    body('username').optional().isLength({ min: 3, max: 30 }),
    body('role').optional().isIn(['USER', 'MODERATOR', 'ADMIN']),
    body('isActive').optional().isBoolean()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updates,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          isBanned: true
        }
      });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_UPDATE_USER',
        entity: 'User',
        entityId: userId,
        details: updates,
        ipAddress: req.ip
      });

      res.json(updated);
    } catch (error) {
      logger.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// Ban user
router.post('/users/:userId/ban',
  [
    param('userId').isUUID(),
    body('reason').isString().isLength({ min: 1, max: 500 })
  ],
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (userId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.role === 'ADMIN') {
        return res.status(400).json({ error: 'Cannot ban an admin' });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { isBanned: true, banReason: reason }
      });

      // End any active sessions
      await prisma.gameSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, endedAt: new Date() }
      });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_BAN_USER',
        entity: 'User',
        entityId: userId,
        details: { reason },
        ipAddress: req.ip
      });

      res.json({ message: 'User banned' });
    } catch (error) {
      logger.error('Error banning user:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  }
);

// Unban user
router.post('/users/:userId/unban',
  param('userId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;

      await prisma.user.update({
        where: { id: userId },
        data: { isBanned: false, banReason: null }
      });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_UNBAN_USER',
        entity: 'User',
        entityId: userId,
        ipAddress: req.ip
      });

      res.json({ message: 'User unbanned' });
    } catch (error) {
      logger.error('Error unbanning user:', error);
      res.status(500).json({ error: 'Failed to unban user' });
    }
  }
);

// Delete user
router.delete('/users/:userId',
  param('userId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;

      if (userId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.role === 'ADMIN') {
        return res.status(400).json({ error: 'Cannot delete an admin' });
      }

      await prisma.user.delete({ where: { id: userId } });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_DELETE_USER',
        entity: 'User',
        entityId: userId,
        details: { email: user.email, username: user.username },
        ipAddress: req.ip
      });

      res.json({ message: 'User deleted' });
    } catch (error) {
      logger.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// ==================== ROM MANAGEMENT ====================

// List ROMs (admin view)
router.get('/roms',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('system').optional().isString(),
    query('search').optional().isString(),
    query('verified').optional().isBoolean().toBoolean()
  ],
  async (req, res) => {
    try {
      const { page = 1, limit = 20, system, search, verified } = req.query as any;

      const where: any = {};

      if (system) {
        where.system = system;
      }

      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      if (verified !== undefined) {
        where.isVerified = verified;
      }

      const [roms, total] = await Promise.all([
        prisma.rom.findMany({
          where,
          include: {
            uploadedBy: {
              select: { username: true }
            },
            _count: {
              select: { sessions: true, userLibraries: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.rom.count({ where })
      ]);

      res.json({
        roms: roms.map(r => ({
          ...r,
          filesize: Number(r.filesize)
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error) {
      logger.error('Error listing ROMs:', error);
      res.status(500).json({ error: 'Failed to list ROMs' });
    }
  }
);

// Update ROM
router.patch('/roms/:romId',
  [
    param('romId').isUUID(),
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('isPublic').optional().isBoolean(),
    body('isVerified').optional().isBoolean(),
    body('genre').optional().isArray(),
    body('developer').optional().isString(),
    body('publisher').optional().isString(),
    body('region').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { romId } = req.params;
      const updates = req.body;

      const rom = await prisma.rom.update({
        where: { id: romId },
        data: updates
      });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_UPDATE_ROM',
        entity: 'Rom',
        entityId: romId,
        details: updates,
        ipAddress: req.ip
      });

      res.json(rom);
    } catch (error) {
      logger.error('Error updating ROM:', error);
      res.status(500).json({ error: 'Failed to update ROM' });
    }
  }
);

// Delete ROM
router.delete('/roms/:romId',
  param('romId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { romId } = req.params;

      const rom = await prisma.rom.findUnique({ where: { id: romId } });
      if (!rom) {
        return res.status(404).json({ error: 'ROM not found' });
      }

      // Delete file
      try {
        await fs.unlink(rom.filepath);
      } catch (e) {
        logger.warn(`Could not delete ROM file: ${rom.filepath}`);
      }

      // Delete cover art if exists
      if (rom.coverArt) {
        try {
          await fs.unlink(rom.coverArt);
        } catch (e) {}
      }

      await prisma.rom.delete({ where: { id: romId } });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_DELETE_ROM',
        entity: 'Rom',
        entityId: romId,
        details: { title: rom.title, system: rom.system },
        ipAddress: req.ip
      });

      res.json({ message: 'ROM deleted' });
    } catch (error) {
      logger.error('Error deleting ROM:', error);
      res.status(500).json({ error: 'Failed to delete ROM' });
    }
  }
);

// ==================== SYSTEM CONFIG ====================

// Get system config
router.get('/config', async (req, res) => {
  try {
    const configs = await prisma.systemConfig.findMany();
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    res.json(configMap);
  } catch (error) {
    logger.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

// Update system config
router.put('/config/:key',
  [
    param('key').isString(),
    body('value').exists()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      await prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_UPDATE_CONFIG',
        entity: 'SystemConfig',
        entityId: key,
        details: { value },
        ipAddress: req.ip
      });

      res.json({ message: 'Config updated' });
    } catch (error) {
      logger.error('Error updating config:', error);
      res.status(500).json({ error: 'Failed to update config' });
    }
  }
);

// ==================== AUDIT LOG ====================

// Get audit logs
router.get('/audit',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('action').optional().isString(),
    query('userId').optional().isUUID()
  ],
  async (req, res) => {
    try {
      const { page = 1, limit = 50, action, userId } = req.query as any;

      const where: any = {};
      if (action) where.action = action;
      if (userId) where.userId = userId;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.auditLog.count({ where })
      ]);

      res.json({
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      res.status(500).json({ error: 'Failed to get audit logs' });
    }
  }
);

// ==================== ACTIVE SESSIONS ====================

// Get active sessions
router.get('/sessions/active', async (req, res) => {
  try {
    const sessions = await prisma.gameSession.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: { id: true, username: true }
        },
        rom: {
          select: { title: true, system: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json(sessions);
  } catch (error) {
    logger.error('Error getting active sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Force end session
router.post('/sessions/:sessionId/end',
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

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          endedAt: new Date(),
          duration: Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
        }
      });

      // Kill process if running
      if (session.processId) {
        try {
          process.kill(session.processId, 'SIGTERM');
        } catch (e) {}
      }

      await createAuditLog({
        userId: req.user!.id,
        action: 'ADMIN_END_SESSION',
        entity: 'GameSession',
        entityId: sessionId,
        ipAddress: req.ip
      });

      res.json({ message: 'Session ended' });
    } catch (error) {
      logger.error('Error ending session:', error);
      res.status(500).json({ error: 'Failed to end session' });
    }
  }
);

export default router;
