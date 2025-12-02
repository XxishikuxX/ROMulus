import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Cheat code formats by system
const CHEAT_FORMATS: Record<string, string[]> = {
  NES: ['Game Genie', 'Pro Action Replay', 'Raw'],
  SNES: ['Game Genie', 'Pro Action Replay', 'Raw'],
  N64: ['GameShark', 'Raw'],
  GB: ['Game Genie', 'GameShark', 'Raw'],
  GBC: ['Game Genie', 'GameShark', 'Raw'],
  GBA: ['GameShark', 'Action Replay', 'CodeBreaker', 'Raw'],
  GENESIS: ['Game Genie', 'Pro Action Replay', 'Raw'],
  MASTER_SYSTEM: ['Pro Action Replay', 'Raw'],
  PS1: ['GameShark', 'Raw'],
  PS2: ['CodeBreaker', 'Action Replay MAX', 'Raw'],
  PSP: ['CWCheat', 'Raw'],
  DREAMCAST: ['Code Breaker', 'Raw'],
  GAMECUBE: ['Action Replay', 'Gecko', 'Raw'],
  WII: ['Gecko', 'Ocarina', 'Raw'],
  NDS: ['Action Replay', 'Raw'],
};

// Search cheats by game
router.get('/game/:gameId', authMiddleware, async (req: any, res) => {
  try {
    const { gameId } = req.params;
    const { format, category, search } = req.query;

    const whereClause: any = {
      OR: [
        { romId: gameId },
        { gameTitle: { contains: gameId, mode: 'insensitive' } },
      ],
    };

    if (format) {
      whereClause.format = format;
    }
    if (category) {
      whereClause.category = category;
    }
    if (search) {
      whereClause.AND = {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ],
      };
    }

    const cheats = await prisma.cheatCode.findMany({
      where: whereClause,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    // Group by category
    const grouped = cheats.reduce((acc, cheat) => {
      const cat = cheat.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(cheat);
      return acc;
    }, {} as Record<string, typeof cheats>);

    res.json({
      total: cheats.length,
      cheats,
      grouped,
    });
  } catch (error) {
    console.error('Get cheats error:', error);
    res.status(500).json({ error: 'Failed to get cheats' });
  }
});

// Search cheats globally
router.get('/search', authMiddleware, async (req: any, res) => {
  try {
    const { q, system, format, limit = 50 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const whereClause: any = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { gameTitle: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ],
    };

    if (system) {
      whereClause.system = system;
    }
    if (format) {
      whereClause.format = format;
    }

    const cheats = await prisma.cheatCode.findMany({
      where: whereClause,
      take: parseInt(limit as string),
      orderBy: { gameTitle: 'asc' },
    });

    res.json({ cheats });
  } catch (error) {
    console.error('Search cheats error:', error);
    res.status(500).json({ error: 'Failed to search cheats' });
  }
});

// Get user's saved/favorite cheats
router.get('/favorites', authMiddleware, async (req: any, res) => {
  try {
    const favorites = await prisma.userFavoriteCheat.findMany({
      where: { userId: req.user.id },
      include: { cheat: true },
      orderBy: { addedAt: 'desc' },
    });

    res.json({
      favorites: favorites.map(f => ({
        ...f.cheat,
        addedAt: f.addedAt,
      })),
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Add cheat to favorites
router.post('/favorites/:cheatId', authMiddleware, async (req: any, res) => {
  try {
    const { cheatId } = req.params;

    const cheat = await prisma.cheatCode.findUnique({ where: { id: cheatId } });
    if (!cheat) {
      return res.status(404).json({ error: 'Cheat not found' });
    }

    await prisma.userFavoriteCheat.create({
      data: {
        userId: req.user.id,
        cheatId,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.json({ success: true, message: 'Already in favorites' });
    }
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove cheat from favorites
router.delete('/favorites/:cheatId', authMiddleware, async (req: any, res) => {
  try {
    const { cheatId } = req.params;

    await prisma.userFavoriteCheat.deleteMany({
      where: {
        userId: req.user.id,
        cheatId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Get user's custom cheats
router.get('/custom', authMiddleware, async (req: any, res) => {
  try {
    const customCheats = await prisma.cheatCode.findMany({
      where: {
        createdBy: req.user.id,
        isCustom: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ cheats: customCheats });
  } catch (error) {
    console.error('Get custom cheats error:', error);
    res.status(500).json({ error: 'Failed to get custom cheats' });
  }
});

// Create custom cheat
router.post('/custom', authMiddleware, async (req: any, res) => {
  try {
    const { romId, gameTitle, system, name, description, code, format, category } = req.body;

    if (!name || !code || !system) {
      return res.status(400).json({ error: 'Name, code, and system required' });
    }

    const validFormats = CHEAT_FORMATS[system];
    if (format && validFormats && !validFormats.includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format for system',
        validFormats,
      });
    }

    const cheat = await prisma.cheatCode.create({
      data: {
        romId,
        gameTitle: gameTitle || 'Custom',
        system,
        name,
        description,
        code,
        format: format || 'Raw',
        category: category || 'Custom',
        isCustom: true,
        createdBy: req.user.id,
        isVerified: false,
      },
    });

    res.json({ cheat });
  } catch (error) {
    console.error('Create custom cheat error:', error);
    res.status(500).json({ error: 'Failed to create cheat' });
  }
});

// Update custom cheat
router.put('/custom/:cheatId', authMiddleware, async (req: any, res) => {
  try {
    const { cheatId } = req.params;
    const { name, description, code, category } = req.body;

    const existing = await prisma.cheatCode.findFirst({
      where: {
        id: cheatId,
        createdBy: req.user.id,
        isCustom: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cheat not found or not yours' });
    }

    const cheat = await prisma.cheatCode.update({
      where: { id: cheatId },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        code: code || existing.code,
        category: category || existing.category,
      },
    });

    res.json({ cheat });
  } catch (error) {
    console.error('Update custom cheat error:', error);
    res.status(500).json({ error: 'Failed to update cheat' });
  }
});

// Delete custom cheat
router.delete('/custom/:cheatId', authMiddleware, async (req: any, res) => {
  try {
    const { cheatId } = req.params;

    const existing = await prisma.cheatCode.findFirst({
      where: {
        id: cheatId,
        createdBy: req.user.id,
        isCustom: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cheat not found or not yours' });
    }

    await prisma.cheatCode.delete({ where: { id: cheatId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete custom cheat error:', error);
    res.status(500).json({ error: 'Failed to delete cheat' });
  }
});

// Get supported formats for a system
router.get('/formats/:system', authMiddleware, async (req: any, res) => {
  try {
    const { system } = req.params;
    const formats = CHEAT_FORMATS[system] || ['Raw'];
    res.json({ system, formats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get formats' });
  }
});

// Get cheat categories for a system
router.get('/categories/:system', authMiddleware, async (req: any, res) => {
  try {
    const { system } = req.params;

    const categories = await prisma.cheatCode.groupBy({
      by: ['category'],
      where: { system },
      _count: { category: true },
    });

    res.json({
      categories: categories.map(c => ({
        name: c.category,
        count: c._count.category,
      })),
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Convert cheat format (e.g., Game Genie to Raw)
router.post('/convert', authMiddleware, async (req: any, res) => {
  try {
    const { code, fromFormat, toFormat, system } = req.body;

    if (!code || !fromFormat || !toFormat || !system) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Conversion logic (simplified - real implementation would be more complex)
    let converted = code;

    // Game Genie to Raw for NES
    if (system === 'NES' && fromFormat === 'Game Genie' && toFormat === 'Raw') {
      converted = convertNESGameGenie(code);
    }
    // Game Genie to Raw for SNES
    else if (system === 'SNES' && fromFormat === 'Game Genie' && toFormat === 'Raw') {
      converted = convertSNESGameGenie(code);
    }
    // Add more conversions as needed

    res.json({
      original: code,
      converted,
      fromFormat,
      toFormat,
    });
  } catch (error) {
    console.error('Convert error:', error);
    res.status(500).json({ error: 'Failed to convert cheat' });
  }
});

// Import cheats from file (admin only)
router.post('/import', authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const { cheats, system, gameTitle, romId } = req.body;

    if (!cheats || !Array.isArray(cheats) || !system) {
      return res.status(400).json({ error: 'Invalid import data' });
    }

    const created = [];
    const errors = [];

    for (const cheat of cheats) {
      try {
        const record = await prisma.cheatCode.create({
          data: {
            romId: romId || null,
            gameTitle: gameTitle || cheat.gameTitle || 'Unknown',
            system,
            name: cheat.name,
            description: cheat.description || '',
            code: cheat.code,
            format: cheat.format || 'Raw',
            category: cheat.category || 'Misc',
            isCustom: false,
            isVerified: true,
          },
        });
        created.push(record);
      } catch (e: any) {
        errors.push({ cheat: cheat.name, error: e.message });
      }
    }

    res.json({
      imported: created.length,
      errors: errors.length,
      details: errors,
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import cheats' });
  }
});

// Export cheats for a game
router.get('/export/:gameId', authMiddleware, async (req: any, res) => {
  try {
    const { gameId } = req.params;
    const { format = 'json' } = req.query;

    const cheats = await prisma.cheatCode.findMany({
      where: {
        OR: [
          { romId: gameId },
          { gameTitle: { contains: gameId, mode: 'insensitive' } },
        ],
      },
    });

    if (format === 'cht') {
      // RetroArch .cht format
      let content = `cheats = ${cheats.length}\n\n`;
      cheats.forEach((cheat, i) => {
        content += `cheat${i}_desc = "${cheat.name}"\n`;
        content += `cheat${i}_code = "${cheat.code}"\n`;
        content += `cheat${i}_enable = false\n\n`;
      });

      res.set({
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${gameId}.cht"`,
      });
      return res.send(content);
    }

    // Default JSON export
    res.json({ cheats });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export cheats' });
  }
});

// Helper functions for cheat conversion
function convertNESGameGenie(code: string): string {
  // NES Game Genie conversion logic
  const codeMap: Record<string, number> = {
    'A': 0x0, 'P': 0x1, 'Z': 0x2, 'L': 0x3,
    'G': 0x4, 'I': 0x5, 'T': 0x6, 'Y': 0x7,
    'E': 0x8, 'O': 0x9, 'X': 0xA, 'U': 0xB,
    'K': 0xC, 'S': 0xD, 'V': 0xE, 'N': 0xF,
  };

  const cleanCode = code.toUpperCase().replace(/[^APZLGITYEOXUKSVN]/g, '');
  
  if (cleanCode.length !== 6 && cleanCode.length !== 8) {
    return code; // Invalid format, return original
  }

  try {
    const values = [...cleanCode].map(c => codeMap[c]);
    
    // 6-character code
    let address = 0x8000 + (
      ((values[3] & 7) << 12) |
      ((values[5] & 7) << 8) |
      ((values[4] & 8) << 8) |
      ((values[2] & 7) << 4) |
      ((values[1] & 8) << 4) |
      (values[4] & 7) |
      (values[3] & 8)
    );

    let data = (
      ((values[1] & 7) << 4) |
      ((values[0] & 8) << 4) |
      (values[0] & 7) |
      (values[5] & 8)
    );

    if (cleanCode.length === 8) {
      // 8-character code has compare value
      let compare = (
        ((values[7] & 7) << 4) |
        ((values[6] & 8) << 4) |
        (values[6] & 7) |
        (values[7] & 8)
      );
      return `${address.toString(16).toUpperCase()}:${data.toString(16).toUpperCase().padStart(2, '0')}?${compare.toString(16).toUpperCase().padStart(2, '0')}`;
    }

    return `${address.toString(16).toUpperCase()}:${data.toString(16).toUpperCase().padStart(2, '0')}`;
  } catch {
    return code;
  }
}

function convertSNESGameGenie(code: string): string {
  // SNES Game Genie conversion logic (simplified)
  const cleanCode = code.toUpperCase().replace(/-/g, '');
  
  if (cleanCode.length !== 9) {
    return code;
  }

  // SNES Game Genie uses a different encoding
  // This is a placeholder - full implementation would be more complex
  return code;
}

export default router;
export { CHEAT_FORMATS };
