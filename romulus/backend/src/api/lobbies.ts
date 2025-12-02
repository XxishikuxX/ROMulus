import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { param, body, query, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { emitToUser, emitToLobby, joinLobbyRoom, leaveLobbyRoom } from '../services/socket';

const router = Router();
const prisma = new PrismaClient();

// Get open lobbies
router.get('/',
  [
    query('system').optional().isString(),
    query('game').optional().isUUID()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { system, game } = req.query;

      const where: any = {
        status: { in: ['WAITING', 'STARTING'] },
        isPrivate: false
      };

      if (game) {
        where.romId = game;
      }

      const lobbies = await prisma.lobby.findMany({
        where,
        include: {
          host: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true
                }
              }
            }
          },
          _count: {
            select: { members: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Filter by system if specified (need to check ROM)
      let filteredLobbies = lobbies;
      if (system && lobbies.length > 0) {
        const romIds = lobbies.filter(l => l.romId).map(l => l.romId!);
        const roms = await prisma.rom.findMany({
          where: { id: { in: romIds }, system: system as any }
        });
        const systemRomIds = new Set(roms.map(r => r.id));
        filteredLobbies = lobbies.filter(l => !l.romId || systemRomIds.has(l.romId));
      }

      res.json(filteredLobbies.map(lobby => ({
        id: lobby.id,
        name: lobby.name,
        host: lobby.host,
        memberCount: lobby._count.members,
        maxPlayers: lobby.maxPlayers,
        isPrivate: lobby.isPrivate,
        status: lobby.status,
        romId: lobby.romId,
        createdAt: lobby.createdAt
      })));
    } catch (error) {
      logger.error('Error getting lobbies:', error);
      res.status(500).json({ error: 'Failed to get lobbies' });
    }
  }
);

// Get lobby details
router.get('/:lobbyId',
  param('lobbyId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId } = req.params;

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: {
          host: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true
                }
              }
            },
            orderBy: { joinedAt: 'asc' }
          },
          messages: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
          }
        }
      });

      if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      // Get ROM info if set
      let rom = null;
      if (lobby.romId) {
        rom = await prisma.rom.findUnique({
          where: { id: lobby.romId },
          select: {
            id: true,
            title: true,
            system: true,
            coverArt: true,
            players: true
          }
        });
      }

      res.json({
        ...lobby,
        rom,
        messages: lobby.messages.reverse(), // Show oldest first
        isMember: lobby.members.some(m => m.userId === req.user!.id),
        isHost: lobby.hostId === req.user!.id
      });
    } catch (error) {
      logger.error('Error getting lobby:', error);
      res.status(500).json({ error: 'Failed to get lobby' });
    }
  }
);

// Create lobby
router.post('/',
  [
    body('name').isString().isLength({ min: 1, max: 100 }),
    body('romId').optional().isUUID(),
    body('maxPlayers').optional().isInt({ min: 2, max: 8 }),
    body('isPrivate').optional().isBoolean(),
    body('password').optional().isString().isLength({ min: 4 })
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, romId, maxPlayers = 4, isPrivate = false, password } = req.body;

      // Check if user is already in a lobby
      const existingMembership = await prisma.lobbyMember.findFirst({
        where: {
          userId: req.user!.id,
          lobby: { status: { in: ['WAITING', 'STARTING', 'INGAME'] } }
        }
      });

      if (existingMembership) {
        return res.status(400).json({ error: 'Already in a lobby' });
      }

      // Verify ROM exists if specified
      if (romId) {
        const rom = await prisma.rom.findUnique({ where: { id: romId } });
        if (!rom) {
          return res.status(404).json({ error: 'Game not found' });
        }
      }

      // Hash password if provided
      let hashedPassword = null;
      if (isPrivate && password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Create lobby
      const lobby = await prisma.lobby.create({
        data: {
          name,
          hostId: req.user!.id,
          romId,
          maxPlayers,
          isPrivate,
          password: hashedPassword,
          members: {
            create: {
              userId: req.user!.id,
              isReady: true // Host is always ready
            }
          }
        },
        include: {
          host: {
            select: { id: true, username: true, avatar: true }
          }
        }
      });

      logger.info(`Lobby created: ${lobby.name} by ${req.user!.username}`);

      res.status(201).json({
        id: lobby.id,
        name: lobby.name,
        host: lobby.host,
        maxPlayers: lobby.maxPlayers,
        isPrivate: lobby.isPrivate,
        status: lobby.status
      });
    } catch (error) {
      logger.error('Error creating lobby:', error);
      res.status(500).json({ error: 'Failed to create lobby' });
    }
  }
);

// Join lobby
router.post('/:lobbyId/join',
  [
    param('lobbyId').isUUID(),
    body('password').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId } = req.params;
      const { password } = req.body;

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: {
          _count: { select: { members: true } }
        }
      });

      if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      if (lobby.status !== 'WAITING') {
        return res.status(400).json({ error: 'Lobby is not accepting players' });
      }

      if (lobby._count.members >= lobby.maxPlayers) {
        return res.status(400).json({ error: 'Lobby is full' });
      }

      // Check password if private
      if (lobby.isPrivate && lobby.password) {
        if (!password) {
          return res.status(401).json({ error: 'Password required' });
        }
        const validPassword = await bcrypt.compare(password, lobby.password);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid password' });
        }
      }

      // Check if already in another lobby
      const existingMembership = await prisma.lobbyMember.findFirst({
        where: {
          userId: req.user!.id,
          lobby: { status: { in: ['WAITING', 'STARTING', 'INGAME'] } }
        }
      });

      if (existingMembership) {
        if (existingMembership.lobbyId === lobbyId) {
          return res.status(400).json({ error: 'Already in this lobby' });
        }
        return res.status(400).json({ error: 'Already in another lobby' });
      }

      // Join lobby
      const membership = await prisma.lobbyMember.create({
        data: {
          lobbyId,
          userId: req.user!.id
        },
        include: {
          user: {
            select: { id: true, username: true, avatar: true }
          }
        }
      });

      // Notify lobby members
      emitToLobby(lobbyId, 'lobby:member_joined', {
        user: membership.user
      });

      // Join socket room
      joinLobbyRoom(req.user!.id, lobbyId);

      res.json({ message: 'Joined lobby' });
    } catch (error) {
      logger.error('Error joining lobby:', error);
      res.status(500).json({ error: 'Failed to join lobby' });
    }
  }
);

// Leave lobby
router.post('/:lobbyId/leave',
  param('lobbyId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId } = req.params;

      const membership = await prisma.lobbyMember.findFirst({
        where: {
          lobbyId,
          userId: req.user!.id
        }
      });

      if (!membership) {
        return res.status(400).json({ error: 'Not in this lobby' });
      }

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: { _count: { select: { members: true } } }
      });

      if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      // Delete membership
      await prisma.lobbyMember.delete({
        where: { id: membership.id }
      });

      // Leave socket room
      leaveLobbyRoom(req.user!.id, lobbyId);

      // If host is leaving
      if (lobby.hostId === req.user!.id) {
        if (lobby._count.members <= 1) {
          // Close lobby if last member
          await prisma.lobby.update({
            where: { id: lobbyId },
            data: { status: 'CLOSED' }
          });
          emitToLobby(lobbyId, 'lobby:closed', { reason: 'Host left' });
        } else {
          // Transfer host to next member
          const nextHost = await prisma.lobbyMember.findFirst({
            where: { lobbyId },
            orderBy: { joinedAt: 'asc' }
          });

          if (nextHost) {
            await prisma.lobby.update({
              where: { id: lobbyId },
              data: { hostId: nextHost.userId }
            });
            emitToLobby(lobbyId, 'lobby:host_changed', { newHostId: nextHost.userId });
          }
        }
      } else {
        // Notify remaining members
        emitToLobby(lobbyId, 'lobby:member_left', {
          userId: req.user!.id,
          username: req.user!.username
        });
      }

      res.json({ message: 'Left lobby' });
    } catch (error) {
      logger.error('Error leaving lobby:', error);
      res.status(500).json({ error: 'Failed to leave lobby' });
    }
  }
);

// Toggle ready status
router.post('/:lobbyId/ready',
  param('lobbyId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId } = req.params;

      const membership = await prisma.lobbyMember.findFirst({
        where: {
          lobbyId,
          userId: req.user!.id
        }
      });

      if (!membership) {
        return res.status(400).json({ error: 'Not in this lobby' });
      }

      const updated = await prisma.lobbyMember.update({
        where: { id: membership.id },
        data: { isReady: !membership.isReady }
      });

      emitToLobby(lobbyId, 'lobby:ready_changed', {
        userId: req.user!.id,
        isReady: updated.isReady
      });

      res.json({ isReady: updated.isReady });
    } catch (error) {
      logger.error('Error toggling ready:', error);
      res.status(500).json({ error: 'Failed to update ready status' });
    }
  }
);

// Set game for lobby (host only)
router.patch('/:lobbyId/game',
  [
    param('lobbyId').isUUID(),
    body('romId').isUUID()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId } = req.params;
      const { romId } = req.body;

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId }
      });

      if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      if (lobby.hostId !== req.user!.id) {
        return res.status(403).json({ error: 'Only host can change game' });
      }

      if (lobby.status !== 'WAITING') {
        return res.status(400).json({ error: 'Cannot change game now' });
      }

      const rom = await prisma.rom.findUnique({
        where: { id: romId },
        select: { id: true, title: true, system: true, coverArt: true, players: true }
      });

      if (!rom) {
        return res.status(404).json({ error: 'Game not found' });
      }

      await prisma.lobby.update({
        where: { id: lobbyId },
        data: { romId }
      });

      emitToLobby(lobbyId, 'lobby:game_changed', { rom });

      res.json({ rom });
    } catch (error) {
      logger.error('Error setting lobby game:', error);
      res.status(500).json({ error: 'Failed to set game' });
    }
  }
);

// Start game (host only)
router.post('/:lobbyId/start',
  param('lobbyId').isUUID(),
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId } = req.params;

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: {
          members: true
        }
      });

      if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      if (lobby.hostId !== req.user!.id) {
        return res.status(403).json({ error: 'Only host can start' });
      }

      if (lobby.status !== 'WAITING') {
        return res.status(400).json({ error: 'Game already started' });
      }

      if (!lobby.romId) {
        return res.status(400).json({ error: 'No game selected' });
      }

      // Check all members ready
      const allReady = lobby.members.every(m => m.isReady || m.userId === lobby.hostId);
      if (!allReady) {
        return res.status(400).json({ error: 'Not all players are ready' });
      }

      // Update lobby status
      await prisma.lobby.update({
        where: { id: lobbyId },
        data: { status: 'STARTING' }
      });

      emitToLobby(lobbyId, 'lobby:starting', {
        countdown: 5
      });

      // After countdown, start game
      setTimeout(async () => {
        await prisma.lobby.update({
          where: { id: lobbyId },
          data: { status: 'INGAME' }
        });

        emitToLobby(lobbyId, 'lobby:game_started', {
          romId: lobby.romId
        });

        logger.info(`Lobby ${lobbyId} game started`);
      }, 5000);

      res.json({ message: 'Game starting' });
    } catch (error) {
      logger.error('Error starting game:', error);
      res.status(500).json({ error: 'Failed to start game' });
    }
  }
);

// Send chat message
router.post('/:lobbyId/chat',
  [
    param('lobbyId').isUUID(),
    body('content').isString().isLength({ min: 1, max: 500 })
  ],
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId } = req.params;
      const { content } = req.body;

      // Verify membership
      const membership = await prisma.lobbyMember.findFirst({
        where: {
          lobbyId,
          userId: req.user!.id
        }
      });

      if (!membership) {
        return res.status(403).json({ error: 'Not in this lobby' });
      }

      const message = await prisma.message.create({
        data: {
          lobbyId,
          userId: req.user!.id,
          content
        },
        include: {
          user: {
            select: { id: true, username: true }
          }
        }
      });

      emitToLobby(lobbyId, 'lobby:message', {
        id: message.id,
        user: message.user,
        content: message.content,
        createdAt: message.createdAt
      });

      res.json(message);
    } catch (error) {
      logger.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// Kick member (host only)
router.post('/:lobbyId/kick/:userId',
  [
    param('lobbyId').isUUID(),
    param('userId').isUUID()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId, userId } = req.params;

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId }
      });

      if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      if (lobby.hostId !== req.user!.id) {
        return res.status(403).json({ error: 'Only host can kick' });
      }

      if (userId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot kick yourself' });
      }

      const membership = await prisma.lobbyMember.findFirst({
        where: { lobbyId, userId }
      });

      if (!membership) {
        return res.status(404).json({ error: 'User not in lobby' });
      }

      await prisma.lobbyMember.delete({
        where: { id: membership.id }
      });

      leaveLobbyRoom(userId, lobbyId);

      emitToLobby(lobbyId, 'lobby:member_kicked', { userId });
      emitToUser(userId, 'lobby:kicked', { lobbyId, reason: 'Kicked by host' });

      res.json({ message: 'User kicked' });
    } catch (error) {
      logger.error('Error kicking user:', error);
      res.status(500).json({ error: 'Failed to kick user' });
    }
  }
);

// Invite friend
router.post('/:lobbyId/invite/:userId',
  [
    param('lobbyId').isUUID(),
    param('userId').isUUID()
  ],
  async (req: AuthRequest, res) => {
    try {
      const { lobbyId, userId } = req.params;

      // Verify membership
      const membership = await prisma.lobbyMember.findFirst({
        where: {
          lobbyId,
          userId: req.user!.id
        }
      });

      if (!membership) {
        return res.status(403).json({ error: 'Not in this lobby' });
      }

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId }
      });

      if (!lobby || lobby.status !== 'WAITING') {
        return res.status(400).json({ error: 'Cannot invite to this lobby' });
      }

      // Verify friendship
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { adderId: req.user!.id, receiverId: userId },
            { adderId: userId, receiverId: req.user!.id }
          ],
          status: 'ACCEPTED'
        }
      });

      if (!friendship) {
        return res.status(400).json({ error: 'Can only invite friends' });
      }

      // Send invite notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'LOBBY_INVITE',
          title: 'Lobby Invite',
          message: `${req.user!.username} invited you to join "${lobby.name}"`,
          data: { lobbyId, fromUserId: req.user!.id }
        }
      });

      emitToUser(userId, 'lobby:invite', {
        lobbyId,
        lobbyName: lobby.name,
        from: {
          id: req.user!.id,
          username: req.user!.username
        }
      });

      res.json({ message: 'Invite sent' });
    } catch (error) {
      logger.error('Error sending invite:', error);
      res.status(500).json({ error: 'Failed to send invite' });
    }
  }
);

export default router;
