import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import fileUpload from 'express-fileupload';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './api/auth';
import userRoutes from './api/users';
import romRoutes from './api/roms';
import libraryRoutes from './api/library';
import sessionRoutes from './api/sessions';
import socialRoutes from './api/social';
import lobbyRoutes from './api/lobbies';
import statsRoutes from './api/stats';
import adminRoutes from './api/admin';
import uploadRoutes from './api/upload';

// New feature routes
import retroAchievementsRoutes from './api/retroachievements';
import cloudSaveRoutes from './api/cloudsave';
import scraperRoutes from './api/scraper';
import shadersRoutes from './api/shaders';
import emulatorSettingsRoutes from './api/emulator-settings';
import netplayRoutes from './api/netplay';
import cheatsRoutes from './api/cheats';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Import services
import { initializeSocket } from './services/socket';
import { initializeRedis } from './services/redis';
import { logger } from './utils/logger';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Initialize services
initializeRedis();
initializeSocket(io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later.' }
});
app.use('/api/auth', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB max
  useTempFiles: true,
  tempFileDir: process.env.TMP_DIR || '/tmp',
  createParentPath: true,
  abortOnLimit: true
}));

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/roms', authMiddleware, romRoutes);
app.use('/api/library', authMiddleware, libraryRoutes);
app.use('/api/sessions', authMiddleware, sessionRoutes);
app.use('/api/social', authMiddleware, socialRoutes);
app.use('/api/lobbies', authMiddleware, lobbyRoutes);
app.use('/api/stats', authMiddleware, statsRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);

// New Feature Routes
app.use('/api/retroachievements', retroAchievementsRoutes);
app.use('/api/cloudsave', cloudSaveRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/shaders', shadersRoutes);
app.use('/api/emulator-settings', emulatorSettingsRoutes);
app.use('/api/netplay', netplayRoutes);
app.use('/api/cheats', cheatsRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, () => {
  logger.info(`🎮 ROMulus Backend running on ${HOST}:${PORT}`);
  logger.info(`📡 WebSocket server ready`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, io };
