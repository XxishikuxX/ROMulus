import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get current user profile
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    res.json(user);
  } catch (error) {
    logger.error('Error getting profile:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update profile
router.patch('/me',
  [
    body('username').optional().isLength({ min: 3, max: 30 }),
    body('email').optional().isEmail()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email } = req.body;
      const updates: any = {};

      if (username) {
        const existing = await prisma.user.findFirst({
          where: { username, id: { not: req.user!.id } }
        });
        if (existing) {
          return res.status(400).json({ error: 'Username already taken' });
        }
        updates.username = username;
      }

      if (email) {
        const existing = await prisma.user.findFirst({
          where: { email, id: { not: req.user!.id } }
        });
        if (existing) {
          return res.status(400).json({ error: 'Email already in use' });
        }
        updates.email = email;
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: updates,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true
        }
      });

      res.json(user);
    } catch (error) {
      logger.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Change password
router.post('/me/password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const newHash = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { passwordHash: newHash }
      });

      res.json({ message: 'Password updated' });
    } catch (error) {
      logger.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// Get preferences
router.get('/me/preferences', async (req: AuthRequest, res) => {
  try {
    let prefs = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id }
    });

    if (!prefs) {
      prefs = await prisma.userPreferences.create({
        data: { userId: req.user!.id }
      });
    }

    res.json(prefs);
  } catch (error) {
    logger.error('Error getting preferences:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Update preferences
router.patch('/me/preferences',
  [
    body('theme').optional().isIn(['dark', 'light', 'system']),
    body('accentColor').optional().isHexColor(),
    body('sidebarCollapsed').optional().isBoolean(),
    body('gridSize').optional().isIn(['small', 'medium', 'large']),
    body('showBoxArt').optional().isBoolean(),
    body('preferredQuality').optional().isIn(['720p', '1080p', '4k']),
    body('lowLatencyMode').optional().isBoolean(),
    body('emailNotifications').optional().isBoolean(),
    body('friendNotifications').optional().isBoolean(),
    body('achievementNotifications').optional().isBoolean()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updates = req.body;

      const prefs = await prisma.userPreferences.upsert({
        where: { userId: req.user!.id },
        update: updates,
        create: { userId: req.user!.id, ...updates }
      });

      res.json(prefs);
    } catch (error) {
      logger.error('Error updating preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  }
);

// Update controller config
router.put('/me/controller',
  body('config').isObject(),
  async (req: AuthRequest, res) => {
    try {
      const { config } = req.body;

      await prisma.userPreferences.upsert({
        where: { userId: req.user!.id },
        update: { controllerConfig: config },
        create: { userId: req.user!.id, controllerConfig: config }
      });

      res.json({ message: 'Controller config saved' });
    } catch (error) {
      logger.error('Error saving controller config:', error);
      res.status(500).json({ error: 'Failed to save controller config' });
    }
  }
);

// Get notifications
router.get('/me/notifications', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(notifications);
  } catch (error) {
    logger.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notifications as read
router.post('/me/notifications/read', async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;

    if (ids && Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: req.user!.id },
        data: { isRead: true }
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: req.user!.id },
        data: { isRead: true }
      });
    }

    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    logger.error('Error marking notifications:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Delete account
router.delete('/me', async (req: AuthRequest, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.user!.id }
    });

    res.json({ message: 'Account deleted' });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Get user by ID (public profile)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            achievements: true
          }
        }
      }
    });

    if (!user || (await prisma.user.findUnique({ where: { id: userId } }))?.isBanned) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get playtime
    const playtime = await prisma.playTime.aggregate({
      where: { userId },
      _sum: { minutes: true }
    });

    res.json({
      ...user,
      totalPlaytimeHours: Math.floor((playtime._sum.minutes || 0) / 60)
    });
  } catch (error) {
    logger.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
