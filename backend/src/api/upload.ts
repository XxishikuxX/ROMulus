import { Router } from 'express';
import { PrismaClient, GameSystem } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { UploadedFile } from 'express-fileupload';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();

// System file extensions
const SYSTEM_EXTENSIONS: Record<string, GameSystem> = {
  // PlayStation
  '.pkg': 'PS3',
  '.pbp': 'PSP',
  '.vpk': 'VITA',
  '.mai': 'VITA',
  '.cso': 'PSP',
  
  // Xbox
  '.xiso': 'XBOX',
  '.xex': 'XBOX360',
  
  // Nintendo
  '.wud': 'WIIU',
  '.wux': 'WIIU',
  '.rpx': 'WIIU',
  '.wbfs': 'WII',
  '.rvz': 'WII',
  '.gcz': 'GAMECUBE',
  '.3ds': 'N3DS',
  '.cia': 'N3DS',
  '.cxi': 'N3DS',
  '.nds': 'NDS',
  '.dsi': 'NDS',
  '.n64': 'N64',
  '.z64': 'N64',
  '.v64': 'N64',
  '.sfc': 'SNES',
  '.smc': 'SNES',
  '.nes': 'NES',
  '.unf': 'NES',
  '.gba': 'GBA',
  '.gbc': 'GBC',
  '.gb': 'GB',
  
  // Sega
  '.gdi': 'DREAMCAST',
  '.cdi': 'DREAMCAST',
  '.chd': 'DREAMCAST',
  '.md': 'GENESIS',
  '.gen': 'GENESIS',
  '.32x': 'S32X',
  '.sms': 'SMS',
  '.gg': 'GAMEGEAR'
};

// Ambiguous extensions (need system specified)
const AMBIGUOUS_EXTENSIONS = ['.iso', '.bin', '.cue', '.img'];

// Upload ROM
router.post('/rom',
  [
    body('system').optional().isIn(Object.values(GameSystem)),
    body('isPublic').optional().isBoolean(),
    body('title').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.files.file as UploadedFile;
      const { system: specifiedSystem, isPublic = true, title: customTitle } = req.body;

      // Validate file size
      const maxSize = parseInt(process.env.UPLOAD_MAX_SIZE || '5368709120'); // 5GB default
      if (file.size > maxSize) {
        return res.status(400).json({ error: 'File too large' });
      }

      // Determine system from extension
      const ext = path.extname(file.name).toLowerCase();
      let system: GameSystem;

      if (SYSTEM_EXTENSIONS[ext]) {
        system = SYSTEM_EXTENSIONS[ext];
      } else if (AMBIGUOUS_EXTENSIONS.includes(ext)) {
        if (!specifiedSystem) {
          return res.status(400).json({ 
            error: 'System must be specified for this file type',
            hint: 'Include system in request body'
          });
        }
        system = specifiedSystem;
      } else {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      // Calculate checksum
      const fileBuffer = await fs.readFile(file.tempFilePath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Check for duplicate
      const existing = await prisma.rom.findFirst({
        where: { checksum }
      });

      if (existing) {
        // Clean up temp file
        await fs.unlink(file.tempFilePath);
        return res.status(400).json({ 
          error: 'This ROM already exists in the library',
          existingId: existing.id
        });
      }

      // Determine destination path
      const systemFolder = system.toLowerCase();
      const destDir = isPublic 
        ? path.join(process.env.ROM_LIBRARY_PATH || '/opt/emuverse/data/roms/library', systemFolder)
        : path.join(process.env.USER_ROM_PATH || '/opt/emuverse/data/roms/users', req.user!.id, systemFolder);

      await fs.mkdir(destDir, { recursive: true });

      // Generate unique filename
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const destPath = path.join(destDir, sanitizedName);

      // Move file
      await fs.rename(file.tempFilePath, destPath);

      // Extract title from filename
      const title = customTitle || path.basename(file.name, ext)
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Create ROM record
      const rom = await prisma.rom.create({
        data: {
          title,
          filename: sanitizedName,
          filepath: destPath,
          filesize: BigInt(file.size),
          checksum,
          system,
          isPublic,
          uploadedById: req.user!.id
        }
      });

      // Add to uploader's library
      await prisma.userLibrary.create({
        data: {
          userId: req.user!.id,
          romId: rom.id
        }
      });

      await createAuditLog({
        userId: req.user!.id,
        action: 'ROM_UPLOAD',
        entity: 'Rom',
        entityId: rom.id,
        details: { title, system, filesize: file.size },
        ipAddress: req.ip
      });

      logger.info(`ROM uploaded: ${title} (${system}) by ${req.user!.username}`);

      res.status(201).json({
        id: rom.id,
        title: rom.title,
        system: rom.system,
        filesize: Number(rom.filesize)
      });
    } catch (error) {
      logger.error('Error uploading ROM:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// Upload cover art
router.post('/cover/:romId', async (req: AuthRequest, res) => {
  try {
    const { romId } = req.params;

    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file as UploadedFile;

    // Verify ROM exists and user has permission
    const rom = await prisma.rom.findUnique({ where: { id: romId } });
    if (!rom) {
      return res.status(404).json({ error: 'ROM not found' });
    }

    if (rom.uploadedById !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Validate image
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    // Process and save image
    const coversDir = process.env.COVERS_PATH || '/opt/emuverse/data/covers';
    await fs.mkdir(coversDir, { recursive: true });

    const filename = `${romId}.webp`;
    const coverPath = path.join(coversDir, filename);

    // Resize and convert to webp
    await sharp(file.tempFilePath)
      .resize(300, 400, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(coverPath);

    // Clean up temp file
    await fs.unlink(file.tempFilePath);

    // Update ROM
    await prisma.rom.update({
      where: { id: romId },
      data: { coverArt: `/static/covers/${filename}` }
    });

    res.json({ coverArt: `/static/covers/${filename}` });
  } catch (error) {
    logger.error('Error uploading cover:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Upload BIOS file (admin only)
router.post('/bios',
  body('system').isIn(['ps3', 'ps2', 'ps1', 'xbox', 'saturn', 'dreamcast', '3ds', 'nds']),
  async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.files.file as UploadedFile;
      const { system } = req.body;

      const biosDir = path.join(
        process.env.BIOS_PATH || '/opt/emuverse/data/bios',
        system
      );
      await fs.mkdir(biosDir, { recursive: true });

      const destPath = path.join(biosDir, file.name);
      await fs.rename(file.tempFilePath, destPath);

      await createAuditLog({
        userId: req.user!.id,
        action: 'BIOS_UPLOAD',
        entity: 'Bios',
        details: { system, filename: file.name },
        ipAddress: req.ip
      });

      logger.info(`BIOS uploaded: ${file.name} for ${system}`);

      res.json({ message: 'BIOS file uploaded', path: destPath });
    } catch (error) {
      logger.error('Error uploading BIOS:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// Upload user avatar
router.post('/avatar', async (req: AuthRequest, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file as UploadedFile;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    // Max 2MB for avatars
    if (file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (max 2MB)' });
    }

    const avatarsDir = path.join(
      process.env.DATA_DIR || '/opt/emuverse/data',
      'avatars'
    );
    await fs.mkdir(avatarsDir, { recursive: true });

    const filename = `${req.user!.id}.webp`;
    const avatarPath = path.join(avatarsDir, filename);

    // Resize to square
    await sharp(file.tempFilePath)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(avatarPath);

    await fs.unlink(file.tempFilePath);

    const avatarUrl = `/static/avatars/${filename}`;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatar: avatarUrl }
    });

    res.json({ avatar: avatarUrl });
  } catch (error) {
    logger.error('Error uploading avatar:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get upload status/progress
router.get('/status/:uploadId', async (req, res) => {
  // This would be implemented with Redis for tracking chunked uploads
  res.json({ status: 'not_implemented' });
});

export default router;
