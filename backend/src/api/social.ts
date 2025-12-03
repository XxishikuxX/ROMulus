import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { param, query, body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { emitToUser } from '../services/socket';

const router = Router();
const prisma = new PrismaClient();

// Search users
router.get('/users/search',
  query('q').isString().isLength({ min: 2 }),
  async (req: AuthRequest, res) => {
    try {
      const { q } = req.query;

      const users = await prisma.user.findMany({
        where: {
          AND: [
            { id: { not: req.user!.id } },
            { isActive: true },
            { isBanned: false },
            {
              OR: [
                { username: { contains: q as string, mode: 'insensitive' } },
                { email: { contains: q as string, mode: 'insensitive' } }
              ]
            }
          ]
        },
        select: {
          id: true,
          username: true,
          avatar: true,
          lastActiveAt: true
        },
        take: 20
      });

      // Get friendship status for each user
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { adderId: req.user!.id, receiverId: { in: users.map(u => u.id) } },
            { receiverId: req.user!.id, adderId: { in: users.map(u => u.id) } }
          ]
        }
      });

      const friendshipMap = new Map(
        friendships.map(f => [
          f.adderId === req.user!.id ? f.receiverId : f.adderId,
          { status: f.status, isRequester: f.adderId === req.user!.id }
        ])
      );

      const usersWithStatus = users.map(user => ({
        ...user,
        isOnline: user.lastActiveAt && 
          (Date.now() - user.lastActiveAt.getTime()) < 5 * 60 * 1000,
        friendshipStatus: friendshipMap.get(user.id)?.status || null,
        isRequester: friendshipMap.get(user.id)?.isRequester || false
      }));

      res.json(usersWithStatus);
    } catch (error) {
      logger.error('Error searching users:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

// Get friends list
router.get('/friends', async (req: AuthRequest, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { adderId: req.user!.id, status: 'ACCEPTED' },
          { receiverId: req.user!.id, status: 'ACCEPTED' }
        ]
      },
      include: {
        adder: {
          select: {
            id: true,
            username: true,
            avatar: true,
            lastActiveAt: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            avatar: true,
            lastActiveAt: true
          }
        }
      }
    });

    const friends = friendships.map(f => {
      const friend = f.adderId === req.user!.id ? f.receiver : f.adder;
      return {
        ...friend,
        isOnline: friend.lastActiveAt && 
          (Date.now() - friend.lastActiveAt.getTime()) < 5 * 60 * 1000,
        friendshipId: f.id,
        friendsSince: f.updatedAt
      };
    });

    // Get current activity for online friends
    const onlineFriendIds = friends.filter(f => f.isOnline).map(f => f.id);
    const activeSessions = await prisma.gameSession.findMany({
      where: {
        userId: { in: onlineFriendIds },
        isActive: true
      },
      include: {
        rom: {
          select: {
            title: true,
            system: true
          }
        }
      }
    });

    const sessionMap = new Map(activeSessions.map(s => [s.userId, s]));

    const friendsWithActivity = friends.map(friend => ({
      ...friend,
      currentGame: sessionMap.get(friend.id)?.rom || null
    }));

    res.json(friendsWithActivity);
  } catch (error) {
    logger.error('Error getting friends:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

// Get pending friend requests
router.get('/friends/requests', async (req: AuthRequest, res) => {
  try {
    const [received, sent] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          receiverId: req.user!.id,
          status: 'PENDING'
        },
        include: {
          adder: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.friendship.findMany({
        where: {
          adderId: req.user!.id,
          status: 'PENDING'
        },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.json({
      received: received.map(r => ({
        id: r.id,
        user: r.adder,
        createdAt: r.createdAt
      })),
      sent: sent.map(s => ({
        id: s.id,
        user: s.receiver,
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    logger.error('Error getting friend requests:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

// Send friend request
router.post('/friends/request/:userId',
  param('userId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;

      if (userId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot friend yourself' });
      }

      // Check user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!targetUser || targetUser.isBanned || !targetUser.isActive) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check existing friendship
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { adderId: req.user!.id, receiverId: userId },
            { adderId: userId, receiverId: req.user!.id }
          ]
        }
      });

      if (existing) {
        if (existing.status === 'ACCEPTED') {
          return res.status(400).json({ error: 'Already friends' });
        }
        if (existing.status === 'BLOCKED') {
          return res.status(400).json({ error: 'Unable to send request' });
        }
        return res.status(400).json({ error: 'Request already pending' });
      }

      // Create friendship
      const friendship = await prisma.friendship.create({
        data: {
          adderId: req.user!.id,
          receiverId: userId
        }
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'FRIEND_REQUEST',
          title: 'New Friend Request',
          message: `${req.user!.username} wants to be your friend`,
          data: { friendshipId: friendship.id, fromUserId: req.user!.id }
        }
      });

      // Real-time notification
      emitToUser(userId, 'friend:request', {
        from: {
          id: req.user!.id,
          username: req.user!.username
        },
        friendshipId: friendship.id
      });

      res.status(201).json({ message: 'Friend request sent' });
    } catch (error) {
      logger.error('Error sending friend request:', error);
      res.status(500).json({ error: 'Failed to send request' });
    }
  }
);

// Accept friend request
router.post('/friends/accept/:friendshipId',
  param('friendshipId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { friendshipId } = req.params;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId }
      });

      if (!friendship) {
        return res.status(404).json({ error: 'Request not found' });
      }

      if (friendship.receiverId !== req.user!.id) {
        return res.status(403).json({ error: 'Not your request' });
      }

      if (friendship.status !== 'PENDING') {
        return res.status(400).json({ error: 'Request already processed' });
      }

      await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: 'ACCEPTED' }
      });

      // Notify the requester
      await prisma.notification.create({
        data: {
          userId: friendship.adderId,
          type: 'FRIEND_ACCEPTED',
          title: 'Friend Request Accepted',
          message: `${req.user!.username} accepted your friend request`,
          data: { userId: req.user!.id }
        }
      });

      emitToUser(friendship.adderId, 'friend:accepted', {
        user: {
          id: req.user!.id,
          username: req.user!.username
        }
      });

      res.json({ message: 'Friend request accepted' });
    } catch (error) {
      logger.error('Error accepting friend request:', error);
      res.status(500).json({ error: 'Failed to accept request' });
    }
  }
);

// Decline/cancel friend request
router.delete('/friends/request/:friendshipId',
  param('friendshipId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { friendshipId } = req.params;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId }
      });

      if (!friendship) {
        return res.status(404).json({ error: 'Request not found' });
      }

      // Can delete if you're either party
      if (friendship.adderId !== req.user!.id && friendship.receiverId !== req.user!.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (friendship.status !== 'PENDING') {
        return res.status(400).json({ error: 'Cannot cancel processed request' });
      }

      await prisma.friendship.delete({
        where: { id: friendshipId }
      });

      res.json({ message: 'Request cancelled' });
    } catch (error) {
      logger.error('Error cancelling friend request:', error);
      res.status(500).json({ error: 'Failed to cancel request' });
    }
  }
);

// Remove friend
router.delete('/friends/:userId',
  param('userId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;

      const deleted = await prisma.friendship.deleteMany({
        where: {
          OR: [
            { adderId: req.user!.id, receiverId: userId },
            { adderId: userId, receiverId: req.user!.id }
          ],
          status: 'ACCEPTED'
        }
      });

      if (deleted.count === 0) {
        return res.status(404).json({ error: 'Friendship not found' });
      }

      res.json({ message: 'Friend removed' });
    } catch (error) {
      logger.error('Error removing friend:', error);
      res.status(500).json({ error: 'Failed to remove friend' });
    }
  }
);

// Block user
router.post('/block/:userId',
  param('userId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;

      if (userId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot block yourself' });
      }

      // Remove existing friendship if any
      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { adderId: req.user!.id, receiverId: userId },
            { adderId: userId, receiverId: req.user!.id }
          ]
        }
      });

      // Create blocked relationship
      await prisma.friendship.create({
        data: {
          adderId: req.user!.id,
          receiverId: userId,
          status: 'BLOCKED'
        }
      });

      res.json({ message: 'User blocked' });
    } catch (error) {
      logger.error('Error blocking user:', error);
      res.status(500).json({ error: 'Failed to block user' });
    }
  }
);

// Unblock user
router.delete('/block/:userId',
  param('userId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;

      await prisma.friendship.deleteMany({
        where: {
          adderId: req.user!.id,
          receiverId: userId,
          status: 'BLOCKED'
        }
      });

      res.json({ message: 'User unblocked' });
    } catch (error) {
      logger.error('Error unblocking user:', error);
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  }
);

// Get activity feed
router.get('/activity', async (req: AuthRequest, res) => {
  try {
    // Get friend IDs
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { adderId: req.user!.id, status: 'ACCEPTED' },
          { receiverId: req.user!.id, status: 'ACCEPTED' }
        ]
      }
    });

    const friendIds = friendships.map(f => 
      f.adderId === req.user!.id ? f.receiverId : f.adderId
    );

    // Get recent sessions from friends
    const recentSessions = await prisma.gameSession.findMany({
      where: {
        userId: { in: friendIds },
        endedAt: { not: null }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        rom: {
          select: {
            title: true,
            system: true,
            coverArt: true
          }
        }
      },
      orderBy: { endedAt: 'desc' },
      take: 50
    });

    // Get recent achievements from friends
    const recentAchievements = await prisma.userAchievement.findMany({
      where: {
        userId: { in: friendIds }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        achievement: true
      },
      orderBy: { unlockedAt: 'desc' },
      take: 20
    });

    // Combine and sort by date
    const activity = [
      ...recentSessions.map(s => ({
        type: 'game_played',
        user: s.user,
        game: s.rom,
        duration: s.duration,
        date: s.endedAt
      })),
      ...recentAchievements.map(a => ({
        type: 'achievement',
        user: a.user,
        achievement: a.achievement,
        date: a.unlockedAt
      }))
    ].sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
     .slice(0, 30);

    res.json(activity);
  } catch (error) {
    logger.error('Error getting activity feed:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

export default router;
