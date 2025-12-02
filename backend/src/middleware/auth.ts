import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    username: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        role: string;
      };

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          role: true,
          username: true,
          isActive: true,
          isBanned: true
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.isBanned) {
        return res.status(403).json({ error: 'Account suspended' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account deactivated' });
      }

      // Update last active
      prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() }
      }).catch(() => {}); // Fire and forget

      req.user = {
        id: user.id,
        role: user.role,
        username: user.username
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional auth - doesn't fail if no token
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          userId: string;
          role: string;
        };

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, role: true, username: true, isActive: true, isBanned: true }
        });

        if (user && user.isActive && !user.isBanned) {
          req.user = {
            id: user.id,
            role: user.role,
            username: user.username
          };
        }
      } catch {}
    }

    next();
  } catch {
    next();
  }
};

// Role-based access
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
