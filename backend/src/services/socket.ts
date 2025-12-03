import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

let io: SocketServer | null = null;
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socket IDs
const socketUsers = new Map<string, string>(); // socketId -> userId

export const initializeSocket = (socketServer: SocketServer) => {
  io = socketServer;

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, isActive: true, isBanned: true }
      });

      if (!user || user.isBanned || !user.isActive) {
        return next(new Error('Invalid user'));
      }

      (socket as any).user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    
    if (!user) {
      socket.disconnect();
      return;
    }

    logger.info(`Socket connected: ${user.username} (${socket.id})`);

    // Track socket
    if (!userSockets.has(user.id)) {
      userSockets.set(user.id, new Set());
    }
    userSockets.get(user.id)!.add(socket.id);
    socketUsers.set(socket.id, user.id);

    // Join personal room
    socket.join(`user:${user.id}`);

    // Update presence
    updatePresence(user.id, true);

    // Handle events
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${user.username}`);
      
      const sockets = userSockets.get(user.id);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(user.id);
          updatePresence(user.id, false);
        }
      }
      socketUsers.delete(socket.id);
    });

    // Typing indicator for lobbies
    socket.on('lobby:typing', (lobbyId: string) => {
      socket.to(`lobby:${lobbyId}`).emit('lobby:user_typing', {
        userId: user.id,
        username: user.username
      });
    });

    // Ping for connection keep-alive
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  logger.info('Socket.IO initialized');
};

// Update user presence
const updatePresence = async (userId: string, isOnline: boolean) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() }
    });

    // Notify friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { adderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      }
    });

    const friendIds = friendships.map(f => 
      f.adderId === userId ? f.receiverId : f.adderId
    );

    friendIds.forEach(friendId => {
      emitToUser(friendId, 'friend:presence', {
        userId,
        isOnline
      });
    });
  } catch (err) {
    logger.error('Error updating presence:', err);
  }
};

// Emit to specific user
export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Emit to lobby
export const emitToLobby = (lobbyId: string, event: string, data: any) => {
  if (io) {
    io.to(`lobby:${lobbyId}`).emit(event, data);
  }
};

// Join lobby room
export const joinLobbyRoom = (userId: string, lobbyId: string) => {
  const sockets = userSockets.get(userId);
  if (sockets && io) {
    sockets.forEach(socketId => {
      const socket = io!.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(`lobby:${lobbyId}`);
      }
    });
  }
};

// Leave lobby room
export const leaveLobbyRoom = (userId: string, lobbyId: string) => {
  const sockets = userSockets.get(userId);
  if (sockets && io) {
    sockets.forEach(socketId => {
      const socket = io!.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(`lobby:${lobbyId}`);
      }
    });
  }
};

// Check if user is online
export const isUserOnline = (userId: string): boolean => {
  const sockets = userSockets.get(userId);
  return sockets ? sockets.size > 0 : false;
};

// Get online user count
export const getOnlineCount = (): number => {
  return userSockets.size;
};

export const getIO = () => io;
