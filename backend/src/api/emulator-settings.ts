import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Default emulator settings per system
const DEFAULT_EMULATOR_SETTINGS = {
  // Global defaults
  global: {
    // Run-ahead settings (reduces input lag)
    runAhead: {
      enabled: false,
      frames: 1,
      useSecondInstance: true, // Better compatibility
    },
    // Rewind settings
    rewind: {
      enabled: true,
      bufferSize: 100, // MB
      granularity: 1, // Frames between rewind states
    },
    // Fast forward
    fastForward: {
      speed: 2.0, // Multiplier
      frameSkip: 0,
      holdToActivate: true,
    },
    // Slow motion
    slowMotion: {
      speed: 0.5,
      holdToActivate: true,
    },
    // Video settings
    video: {
      vsync: true,
      hardGpuSync: false,
      maxSwapchainImages: 3,
      frameDelay: 0, // Additional frame delay for lag reduction with vsync
      aspectRatio: 'core', // core, 4:3, 16:9, custom
      integerScale: false,
      smoothing: false, // Bilinear filtering
    },
    // Audio settings
    audio: {
      enabled: true,
      latency: 64, // ms
      volume: 100,
      rateControl: true,
      rateControlDelta: 0.005,
    },
    // Save settings
    saves: {
      autoSaveInterval: 0, // 0 = disabled, otherwise seconds
      sortSavesByCore: true,
      compressSaves: true,
    },
    // Network
    netplay: {
      enabled: false,
      useMitm: true, // Use relay server
      delayFrames: 0,
      checkFrames: 120,
    },
  },

  // System-specific overrides
  NES: {
    runAhead: { enabled: true, frames: 1 },
    video: { aspectRatio: '4:3' },
    rewind: { enabled: true, granularity: 1 },
  },
  SNES: {
    runAhead: { enabled: true, frames: 2 }, // SNES games often have 2 frames of internal lag
    video: { aspectRatio: '4:3' },
    rewind: { enabled: true, granularity: 1 },
  },
  N64: {
    runAhead: { enabled: false }, // Too resource intensive for N64
    video: { aspectRatio: '4:3' },
    rewind: { enabled: true, granularity: 2 },
  },
  GB: {
    runAhead: { enabled: true, frames: 1 },
    video: { aspectRatio: 'core', integerScale: true },
    rewind: { enabled: true, granularity: 1 },
  },
  GBC: {
    runAhead: { enabled: true, frames: 1 },
    video: { aspectRatio: 'core', integerScale: true },
    rewind: { enabled: true, granularity: 1 },
  },
  GBA: {
    runAhead: { enabled: true, frames: 1 },
    video: { aspectRatio: 'core' },
    rewind: { enabled: true, granularity: 1 },
  },
  GENESIS: {
    runAhead: { enabled: true, frames: 1 },
    video: { aspectRatio: '4:3' },
    rewind: { enabled: true, granularity: 1 },
  },
  PS1: {
    runAhead: { enabled: false }, // Large save states
    video: { aspectRatio: '4:3' },
    rewind: { enabled: true, granularity: 2, bufferSize: 200 },
  },
  PS2: {
    runAhead: { enabled: false },
    video: { aspectRatio: '4:3' },
    rewind: { enabled: false }, // Too resource intensive
  },
  PSP: {
    runAhead: { enabled: false },
    video: { aspectRatio: '16:9' },
    rewind: { enabled: true, granularity: 3, bufferSize: 150 },
  },
  DREAMCAST: {
    runAhead: { enabled: false },
    video: { aspectRatio: '4:3' },
    rewind: { enabled: true, granularity: 2, bufferSize: 150 },
  },
  GAMECUBE: {
    runAhead: { enabled: false },
    video: { aspectRatio: '4:3' },
    rewind: { enabled: false },
  },
  WII: {
    runAhead: { enabled: false },
    video: { aspectRatio: '16:9' },
    rewind: { enabled: false },
  },
  NDS: {
    runAhead: { enabled: true, frames: 1 },
    video: { aspectRatio: 'core' },
    rewind: { enabled: true, granularity: 1 },
  },
  ARCADE: {
    runAhead: { enabled: true, frames: 1 },
    video: { aspectRatio: 'core' },
    rewind: { enabled: true, granularity: 1 },
  },
};

// Input lag presets
const INPUT_LAG_PRESETS = {
  'ultra-low': {
    name: 'Ultra Low Latency',
    description: 'Minimum input lag, may cause audio/video issues on slower hardware',
    settings: {
      runAhead: { enabled: true, frames: 2, useSecondInstance: true },
      video: {
        vsync: false,
        hardGpuSync: true,
        frameDelay: 8,
        maxSwapchainImages: 2,
      },
      audio: { latency: 32, rateControl: false },
    },
  },
  'low': {
    name: 'Low Latency',
    description: 'Good balance of low lag and stability',
    settings: {
      runAhead: { enabled: true, frames: 1, useSecondInstance: true },
      video: {
        vsync: true,
        hardGpuSync: true,
        frameDelay: 4,
        maxSwapchainImages: 2,
      },
      audio: { latency: 48, rateControl: true },
    },
  },
  'balanced': {
    name: 'Balanced',
    description: 'Balanced settings for most hardware',
    settings: {
      runAhead: { enabled: false, frames: 0 },
      video: {
        vsync: true,
        hardGpuSync: false,
        frameDelay: 0,
        maxSwapchainImages: 3,
      },
      audio: { latency: 64, rateControl: true },
    },
  },
  'smooth': {
    name: 'Smooth',
    description: 'Prioritizes smooth gameplay over low latency',
    settings: {
      runAhead: { enabled: false, frames: 0 },
      video: {
        vsync: true,
        hardGpuSync: false,
        frameDelay: 0,
        maxSwapchainImages: 4,
      },
      audio: { latency: 96, rateControl: true },
    },
  },
};

// Get global settings
router.get('/global', authMiddleware, async (req: any, res) => {
  try {
    // Get user's global settings or return defaults
    const userSettings = await prisma.userEmulatorSettings.findFirst({
      where: { userId: req.user.id, system: 'global' },
    });

    res.json({
      settings: userSettings?.settings || DEFAULT_EMULATOR_SETTINGS.global,
      isCustom: !!userSettings,
    });
  } catch (error) {
    console.error('Global settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update global settings
router.put('/global', authMiddleware, async (req: any, res) => {
  try {
    const { settings } = req.body;

    const updated = await prisma.userEmulatorSettings.upsert({
      where: {
        userId_system: { userId: req.user.id, system: 'global' },
      },
      update: { settings },
      create: {
        userId: req.user.id,
        system: 'global',
        settings,
      },
    });

    res.json({ settings: updated.settings });
  } catch (error) {
    console.error('Update global settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get settings for a specific system
router.get('/system/:system', authMiddleware, async (req: any, res) => {
  try {
    const { system } = req.params;

    // Get user's system-specific settings
    const userSettings = await prisma.userEmulatorSettings.findFirst({
      where: { userId: req.user.id, system },
    });

    // Get user's global settings
    const globalSettings = await prisma.userEmulatorSettings.findFirst({
      where: { userId: req.user.id, system: 'global' },
    });

    // Merge: defaults < system defaults < user global < user system
    const defaults = DEFAULT_EMULATOR_SETTINGS.global;
    const systemDefaults = DEFAULT_EMULATOR_SETTINGS[system as keyof typeof DEFAULT_EMULATOR_SETTINGS] || {};
    const userGlobal = globalSettings?.settings || {};
    const userSystem = userSettings?.settings || {};

    const merged = deepMerge(defaults, systemDefaults, userGlobal, userSystem);

    res.json({
      system,
      settings: merged,
      defaults: deepMerge(defaults, systemDefaults),
      isCustom: !!userSettings,
    });
  } catch (error) {
    console.error('System settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings for a specific system
router.put('/system/:system', authMiddleware, async (req: any, res) => {
  try {
    const { system } = req.params;
    const { settings } = req.body;

    const updated = await prisma.userEmulatorSettings.upsert({
      where: {
        userId_system: { userId: req.user.id, system },
      },
      update: { settings },
      create: {
        userId: req.user.id,
        system,
        settings,
      },
    });

    res.json({ settings: updated.settings });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Reset system settings to defaults
router.delete('/system/:system', authMiddleware, async (req: any, res) => {
  try {
    const { system } = req.params;

    await prisma.userEmulatorSettings.deleteMany({
      where: { userId: req.user.id, system },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

// Get input lag presets
router.get('/presets/input-lag', authMiddleware, async (req: any, res) => {
  try {
    res.json({
      presets: Object.entries(INPUT_LAG_PRESETS).map(([id, preset]) => ({
        id,
        ...preset,
      })),
    });
  } catch (error) {
    console.error('Input lag presets error:', error);
    res.status(500).json({ error: 'Failed to get presets' });
  }
});

// Apply input lag preset
router.post('/presets/input-lag/:presetId', authMiddleware, async (req: any, res) => {
  try {
    const { presetId } = req.params;
    const { system } = req.body; // Optional: apply to specific system

    const preset = INPUT_LAG_PRESETS[presetId as keyof typeof INPUT_LAG_PRESETS];
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const targetSystem = system || 'global';

    // Get current settings
    const current = await prisma.userEmulatorSettings.findFirst({
      where: { userId: req.user.id, system: targetSystem },
    });

    // Merge preset settings
    const merged = deepMerge(current?.settings || {}, preset.settings);

    const updated = await prisma.userEmulatorSettings.upsert({
      where: {
        userId_system: { userId: req.user.id, system: targetSystem },
      },
      update: { settings: merged },
      create: {
        userId: req.user.id,
        system: targetSystem,
        settings: merged,
      },
    });

    res.json({
      applied: presetId,
      system: targetSystem,
      settings: updated.settings,
    });
  } catch (error) {
    console.error('Apply preset error:', error);
    res.status(500).json({ error: 'Failed to apply preset' });
  }
});

// Get all system defaults
router.get('/defaults', authMiddleware, async (req: any, res) => {
  try {
    res.json({ defaults: DEFAULT_EMULATOR_SETTINGS });
  } catch (error) {
    console.error('Defaults error:', error);
    res.status(500).json({ error: 'Failed to get defaults' });
  }
});

// Export settings (for backup or sharing)
router.get('/export', authMiddleware, async (req: any, res) => {
  try {
    const allSettings = await prisma.userEmulatorSettings.findMany({
      where: { userId: req.user.id },
    });

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: allSettings.reduce((acc, s) => {
        acc[s.system] = s.settings;
        return acc;
      }, {} as Record<string, any>),
    };

    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="emuverse-settings.json"',
    });

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export settings' });
  }
});

// Import settings
router.post('/import', authMiddleware, async (req: any, res) => {
  try {
    const { settings, overwrite = false } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings data' });
    }

    const results = { imported: 0, skipped: 0, errors: 0 };

    for (const [system, systemSettings] of Object.entries(settings)) {
      try {
        if (overwrite) {
          await prisma.userEmulatorSettings.upsert({
            where: {
              userId_system: { userId: req.user.id, system },
            },
            update: { settings: systemSettings },
            create: {
              userId: req.user.id,
              system,
              settings: systemSettings as any,
            },
          });
          results.imported++;
        } else {
          const existing = await prisma.userEmulatorSettings.findFirst({
            where: { userId: req.user.id, system },
          });

          if (!existing) {
            await prisma.userEmulatorSettings.create({
              data: {
                userId: req.user.id,
                system,
                settings: systemSettings as any,
              },
            });
            results.imported++;
          } else {
            results.skipped++;
          }
        }
      } catch (e) {
        console.error(`Import error for ${system}:`, e);
        results.errors++;
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import settings' });
  }
});

// Helper function to deep merge objects
function deepMerge(...objects: any[]): any {
  const result: any = {};

  for (const obj of objects) {
    if (!obj) continue;

    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

export default router;
export { DEFAULT_EMULATOR_SETTINGS, INPUT_LAG_PRESETS };
