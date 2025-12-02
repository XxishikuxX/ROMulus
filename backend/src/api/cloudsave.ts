import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

const SAVES_BASE_PATH = process.env.SAVES_PATH || '/opt/emuverse/data/saves';
const STATES_BASE_PATH = process.env.STATES_PATH || '/opt/emuverse/data/states';

interface SyncManifest {
  version: number;
  lastSync: string;
  deviceId: string;
  files: {
    path: string;
    hash: string;
    size: number;
    modifiedAt: string;
    type: 'save' | 'state';
  }[];
}

// Generate file hash
async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Get user's sync manifest
router.get('/manifest', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const deviceId = req.headers['x-device-id'] as string;

    // Get all synced files for user
    const syncedFiles = await prisma.cloudSave.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    const manifest: SyncManifest = {
      version: 1,
      lastSync: new Date().toISOString(),
      deviceId: deviceId || 'unknown',
      files: syncedFiles.map(f => ({
        path: f.relativePath,
        hash: f.hash,
        size: f.size,
        modifiedAt: f.modifiedAt.toISOString(),
        type: f.type as 'save' | 'state',
      })),
    };

    res.json(manifest);
  } catch (error) {
    console.error('Manifest error:', error);
    res.status(500).json({ error: 'Failed to get manifest' });
  }
});

// Upload save/state file
router.post('/upload', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { relativePath, type, gameId, system, slot } = req.body;
    const file = req.files?.file;

    if (!file || !relativePath || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hash = crypto.createHash('sha256').update(file.data).digest('hex');
    
    // Determine storage path
    const basePath = type === 'save' ? SAVES_BASE_PATH : STATES_BASE_PATH;
    const userPath = path.join(basePath, 'users', userId);
    const fullPath = path.join(userPath, relativePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Check if file exists and has different content
    const existing = await prisma.cloudSave.findFirst({
      where: { userId, relativePath },
    });

    if (existing && existing.hash === hash) {
      return res.json({ 
        status: 'unchanged',
        message: 'File already up to date',
      });
    }

    // Save file
    await fs.writeFile(fullPath, file.data);

    // Create version history if file changed
    if (existing) {
      await prisma.cloudSaveVersion.create({
        data: {
          cloudSaveId: existing.id,
          hash: existing.hash,
          size: existing.size,
          data: await fs.readFile(path.join(userPath, relativePath + '.prev')).catch(() => null),
        },
      });
    }

    // Update or create sync record
    const cloudSave = await prisma.cloudSave.upsert({
      where: {
        userId_relativePath: { userId, relativePath },
      },
      update: {
        hash,
        size: file.data.length,
        modifiedAt: new Date(),
        gameId: gameId || undefined,
        system: system || undefined,
        slot: slot !== undefined ? parseInt(slot) : undefined,
      },
      create: {
        userId,
        relativePath,
        type,
        hash,
        size: file.data.length,
        modifiedAt: new Date(),
        gameId: gameId || undefined,
        system: system || undefined,
        slot: slot !== undefined ? parseInt(slot) : undefined,
      },
    });

    res.json({
      status: 'uploaded',
      file: {
        id: cloudSave.id,
        path: relativePath,
        hash,
        size: file.data.length,
        modifiedAt: cloudSave.modifiedAt,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Download save/state file
router.get('/download', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { relativePath, type } = req.query;

    if (!relativePath || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const basePath = type === 'save' ? SAVES_BASE_PATH : STATES_BASE_PATH;
    const fullPath = path.join(basePath, 'users', userId, relativePath as string);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    const cloudSave = await prisma.cloudSave.findFirst({
      where: { userId, relativePath: relativePath as string },
    });

    const fileContent = await fs.readFile(fullPath);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${path.basename(relativePath as string)}"`,
      'X-File-Hash': cloudSave?.hash || '',
      'X-File-Modified': cloudSave?.modifiedAt?.toISOString() || '',
    });

    res.send(fileContent);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Sync endpoint - compare and merge
router.post('/sync', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const deviceId = req.headers['x-device-id'] as string || 'unknown';
    const { clientManifest } = req.body;

    if (!clientManifest || !Array.isArray(clientManifest.files)) {
      return res.status(400).json({ error: 'Invalid manifest' });
    }

    // Get server files
    const serverFiles = await prisma.cloudSave.findMany({
      where: { userId },
    });

    const serverFileMap = new Map(serverFiles.map(f => [f.relativePath, f]));
    const clientFileMap = new Map(clientManifest.files.map((f: any) => [f.path, f]));

    const actions: {
      upload: string[];    // Client should upload these
      download: string[];  // Client should download these
      conflict: { path: string; serverModified: string; clientModified: string }[];
    } = {
      upload: [],
      download: [],
      conflict: [],
    };

    // Check client files against server
    for (const clientFile of clientManifest.files) {
      const serverFile = serverFileMap.get(clientFile.path);

      if (!serverFile) {
        // New file on client - should upload
        actions.upload.push(clientFile.path);
      } else if (serverFile.hash !== clientFile.hash) {
        // Different content - check timestamps
        const serverTime = new Date(serverFile.modifiedAt).getTime();
        const clientTime = new Date(clientFile.modifiedAt).getTime();

        if (Math.abs(serverTime - clientTime) < 1000) {
          // Within 1 second - conflict
          actions.conflict.push({
            path: clientFile.path,
            serverModified: serverFile.modifiedAt.toISOString(),
            clientModified: clientFile.modifiedAt,
          });
        } else if (serverTime > clientTime) {
          // Server is newer
          actions.download.push(clientFile.path);
        } else {
          // Client is newer
          actions.upload.push(clientFile.path);
        }
      }
      // Same hash - no action needed
    }

    // Check for server files not on client
    for (const serverFile of serverFiles) {
      if (!clientFileMap.has(serverFile.relativePath)) {
        actions.download.push(serverFile.relativePath);
      }
    }

    // Record sync event
    await prisma.syncEvent.create({
      data: {
        userId,
        deviceId,
        filesUploaded: actions.upload.length,
        filesDownloaded: actions.download.length,
        conflicts: actions.conflict.length,
      },
    });

    res.json({
      actions,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync' });
  }
});

// Get sync history
router.get('/history', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const events = await prisma.syncEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({ events });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// List all saves for a game
router.get('/game/:gameId', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;

    const saves = await prisma.cloudSave.findMany({
      where: { userId, gameId },
      orderBy: { modifiedAt: 'desc' },
    });

    res.json({
      saves: saves.map(s => ({
        id: s.id,
        path: s.relativePath,
        type: s.type,
        slot: s.slot,
        size: s.size,
        modifiedAt: s.modifiedAt,
      })),
    });
  } catch (error) {
    console.error('Game saves error:', error);
    res.status(500).json({ error: 'Failed to get saves' });
  }
});

// Delete a save
router.delete('/:saveId', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { saveId } = req.params;

    const save = await prisma.cloudSave.findFirst({
      where: { id: saveId, userId },
    });

    if (!save) {
      return res.status(404).json({ error: 'Save not found' });
    }

    // Delete file
    const basePath = save.type === 'save' ? SAVES_BASE_PATH : STATES_BASE_PATH;
    const fullPath = path.join(basePath, 'users', userId, save.relativePath);

    try {
      await fs.unlink(fullPath);
    } catch {
      // File may not exist
    }

    // Delete record
    await prisma.cloudSave.delete({ where: { id: saveId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete save' });
  }
});

// Get version history for a save
router.get('/:saveId/versions', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { saveId } = req.params;

    const save = await prisma.cloudSave.findFirst({
      where: { id: saveId, userId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!save) {
      return res.status(404).json({ error: 'Save not found' });
    }

    res.json({
      current: {
        hash: save.hash,
        size: save.size,
        modifiedAt: save.modifiedAt,
      },
      versions: save.versions.map(v => ({
        id: v.id,
        hash: v.hash,
        size: v.size,
        createdAt: v.createdAt,
      })),
    });
  } catch (error) {
    console.error('Versions error:', error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

// Restore a previous version
router.post('/:saveId/restore/:versionId', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { saveId, versionId } = req.params;

    const save = await prisma.cloudSave.findFirst({
      where: { id: saveId, userId },
    });

    if (!save) {
      return res.status(404).json({ error: 'Save not found' });
    }

    const version = await prisma.cloudSaveVersion.findFirst({
      where: { id: versionId, cloudSaveId: saveId },
    });

    if (!version || !version.data) {
      return res.status(404).json({ error: 'Version not found or has no data' });
    }

    // Restore file
    const basePath = save.type === 'save' ? SAVES_BASE_PATH : STATES_BASE_PATH;
    const fullPath = path.join(basePath, 'users', userId, save.relativePath);

    await fs.writeFile(fullPath, version.data);

    // Update record
    await prisma.cloudSave.update({
      where: { id: saveId },
      data: {
        hash: version.hash,
        size: version.size,
        modifiedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// WebDAV-compatible endpoint for RetroArch cloud sync
router.propfind('/webdav/*', authMiddleware, async (req: any, res) => {
  // WebDAV PROPFIND for directory listing
  try {
    const userId = req.user.id;
    const requestPath = req.params[0] || '';
    
    const files = await prisma.cloudSave.findMany({
      where: {
        userId,
        relativePath: { startsWith: requestPath },
      },
    });

    // Return WebDAV XML response
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${files.map(f => `
  <D:response>
    <D:href>/api/cloudsave/webdav/${f.relativePath}</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontentlength>${f.size}</D:getcontentlength>
        <D:getlastmodified>${f.modifiedAt.toUTCString()}</D:getlastmodified>
        <D:getetag>"${f.hash}"</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
`).join('')}
</D:multistatus>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('WebDAV PROPFIND error:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
