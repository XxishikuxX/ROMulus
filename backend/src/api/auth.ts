import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { createAuditLog } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters, alphanumeric and underscores only'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Register
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password } = req.body;

    // Check registration enabled
    if (process.env.ENABLE_REGISTRATION !== 'true') {
      return res.status(403).json({ error: 'Registration is currently disabled' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const passwordHash = await bcrypt.hash(password, rounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        preferences: {
          create: {} // Create default preferences
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true
      }
    });

    // Create JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Create refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: 'USER_REGISTER',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip
    });

    logger.info(`New user registered: ${username} (${email})`);

    res.status(201).json({
      user,
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { preferences: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if banned
    if (user.isBanned) {
      return res.status(403).json({ 
        error: 'Account suspended',
        reason: user.banReason 
      });
    }

    // Check if active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Create tokens
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip
    });

    logger.info(`User logged in: ${user.username}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        preferences: user.preferences
      },
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as {
      userId: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || user.isBanned || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Create new tokens
    const newToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Logout (client-side, just for audit)
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        await createAuditLog({
          userId: decoded.userId,
          action: 'USER_LOGOUT',
          entity: 'User',
          entityId: decoded.userId,
          ipAddress: req.ip
        });
      } catch {}
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.json({ message: 'Logged out' });
  }
});

// Password reset request
router.post('/forgot-password', 
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      
      // Always return success to prevent email enumeration
      if (user) {
        // In production, send email with reset link
        // For now, just log
        logger.info(`Password reset requested for: ${email}`);
        
        // Generate reset token (would be sent via email)
        const resetToken = jwt.sign(
          { userId: user.id, type: 'password-reset' },
          process.env.JWT_SECRET!,
          { expiresIn: '1h' }
        );

        // TODO: Send email with reset link
        logger.debug(`Reset token for ${email}: ${resetToken}`);
      }

      res.json({ message: 'If an account exists with this email, a reset link has been sent' });
    } catch (error) {
      logger.error('Password reset request error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }
);

// Password reset
router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== 'password-reset') {
        return res.status(400).json({ error: 'Invalid token' });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

      // Update password
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { passwordHash }
      });

      await createAuditLog({
        userId: decoded.userId,
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: decoded.userId,
        ipAddress: req.ip
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(400).json({ error: 'Invalid or expired token' });
    }
  }
);

// Verify token (for checking auth state)
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        isBanned: true
      }
    });

    if (!user || user.isBanned || !user.isActive) {
      return res.status(401).json({ valid: false });
    }

    res.json({ valid: true, user });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

export default router;
