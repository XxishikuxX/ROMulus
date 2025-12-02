import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

const SHADERS_PATH = process.env.SHADERS_PATH || '/opt/emuverse/data/shaders';

// Predefined shader presets
const SHADER_PRESETS = {
  // CRT Shaders
  'crt-royale': {
    name: 'CRT Royale',
    description: 'High-quality CRT simulation with phosphor mask, bloom, and curvature',
    category: 'crt',
    performance: 'high',
    path: 'shaders_slang/crt/crt-royale.slangp',
    settings: {
      crt_gamma: 2.4,
      lcd_gamma: 2.2,
      levels_contrast: 0.95,
      halation_weight: 0.0,
      diffusion_weight: 0.075,
      bloom_underestimate_levels: 0.8,
      bloom_excess: 0.0,
      beam_min_sigma: 0.02,
      beam_max_sigma: 0.3,
      mask_type: 0, // 0=grille, 1=slot, 2=shadow
      mask_triad_size_desired: 3.0,
      interlace_detect: 1.0,
      aa_level: 12.0,
    },
  },
  'crt-geom': {
    name: 'CRT Geom',
    description: 'Classic CRT shader with geometry correction and scanlines',
    category: 'crt',
    performance: 'medium',
    path: 'shaders_slang/crt/crt-geom.slangp',
    settings: {
      CRTgamma: 2.4,
      monitorgamma: 2.2,
      d: 1.5,
      R: 2.0,
      cornersize: 0.03,
      cornersmooth: 1000.0,
      x_tilt: 0.0,
      y_tilt: 0.0,
      overscan_x: 100.0,
      overscan_y: 100.0,
      DOTMASK: 0.3,
      SHARPER: 1.0,
      scanline_weight: 0.3,
    },
  },
  'crt-lottes': {
    name: 'CRT Lottes',
    description: 'Timothy Lottes CRT shader - lightweight aperture grille simulation',
    category: 'crt',
    performance: 'low',
    path: 'shaders_slang/crt/crt-lottes.slangp',
    settings: {
      hardScan: -8.0,
      hardPix: -3.0,
      warpX: 0.031,
      warpY: 0.041,
      maskDark: 0.5,
      maskLight: 1.5,
      shadowMask: 3.0,
      brightBoost: 1.0,
      hardBloomScan: -1.5,
      hardBloomPix: -2.0,
      bloomAmount: 0.15,
      shape: 2.0,
    },
  },
  'crt-easymode': {
    name: 'CRT EasyMode',
    description: 'Simple but effective CRT shader with good defaults',
    category: 'crt',
    performance: 'low',
    path: 'shaders_slang/crt/crt-easymode.slangp',
    settings: {
      SHARPNESS_H: 0.5,
      SHARPNESS_V: 1.0,
      MASK_STRENGTH: 0.3,
      MASK_DOT_WIDTH: 1.0,
      MASK_DOT_HEIGHT: 1.0,
      MASK_STAGGER: 0.0,
      MASK_SIZE: 1.0,
      SCANLINE_STRENGTH: 1.0,
      SCANLINE_BEAM_WIDTH_MIN: 1.5,
      SCANLINE_BEAM_WIDTH_MAX: 1.5,
      SCANLINE_BRIGHT_MIN: 0.35,
      SCANLINE_BRIGHT_MAX: 0.65,
      SCANLINE_CUTOFF: 400.0,
      GAMMA_INPUT: 2.0,
      GAMMA_OUTPUT: 1.8,
      BRIGHT_BOOST: 1.2,
      DILATION: 1.0,
    },
  },
  'crt-guest-venom': {
    name: 'CRT Guest Dr. Venom',
    description: 'Highly configurable CRT shader with excellent defaults',
    category: 'crt',
    performance: 'medium',
    path: 'shaders_slang/crt/crt-guest-dr-venom2.slangp',
    settings: {
      brightboost: 1.4,
      sat: 1.0,
      glow: 0.08,
      bloom: 0.0,
      mask_bloom: 0.0,
      gamma_out: 2.4,
      smart_ei: 0.0,
      ei_limit: 0.0,
      sth: 0.0,
      scanline1: 6.0,
      scanline2: 8.0,
      beam_min: 1.3,
      beam_max: 1.0,
      s_power: 1.0,
      beam_size: 0.7,
      vertmask: 0.0,
      scans: 0.5,
      scan_falloff: 1.0,
      spike: 1.0,
      h_sharp: 5.2,
      s_sharp: 0.0,
      csize: 0.0,
      bsize1: 0.01,
      warpX: 0.0,
      warpY: 0.0,
    },
  },

  // NTSC Filters
  'ntsc-adaptive': {
    name: 'NTSC Adaptive',
    description: 'Simulates NTSC composite video artifacts',
    category: 'ntsc',
    performance: 'medium',
    path: 'shaders_slang/ntsc/ntsc-adaptive.slangp',
    settings: {
      quality: 1.0,
      cust_artifacting: 1.0,
      cust_fringing: 1.0,
      ntsc_fields: 0.0,
      ntsc_phase: 1.0,
      ntsc_scale: 1.0,
      ntsc_ring: 0.0,
      ntsc_y: 1.0,
      ntsc_i: 0.5,
      ntsc_q: 0.5,
    },
  },
  'blargg-ntsc': {
    name: 'Blargg NTSC',
    description: 'Classic NTSC filter - composite, S-Video, or RGB modes',
    category: 'ntsc',
    performance: 'low',
    path: 'shaders_slang/ntsc/blargg-ntsc.slangp',
    settings: {
      ntsc_hue: 0.0,
      ntsc_saturation: 0.0,
      ntsc_contrast: 0.0,
      ntsc_brightness: 0.0,
      ntsc_sharpness: 0.0,
      ntsc_resolution: 0.0,
      ntsc_artifacts: 0.0,
      ntsc_fringing: 0.0,
      ntsc_bleed: 0.0,
    },
  },

  // Handheld LCD Shaders
  'lcd-gameboy': {
    name: 'Game Boy LCD',
    description: 'Simulates original Game Boy LCD with ghosting',
    category: 'lcd',
    performance: 'low',
    path: 'shaders_slang/handheld/lcd-cgwg/lcd-grid-v2.slangp',
    settings: {
      RSUBPIX_R: 0.333,
      RSUBPIX_G: 0.333,
      RSUBPIX_B: 0.333,
      GSUBPIX_R: 0.333,
      GSUBPIX_G: 0.333,
      GSUBPIX_B: 0.333,
      BSUBPIX_R: 0.333,
      BSUBPIX_G: 0.333,
      BSUBPIX_B: 0.333,
      gain: 1.0,
      gamma: 2.2,
      blacklevel: 0.0,
      ambient: 0.0,
      BGR: 0.0,
    },
  },
  'lcd-gba': {
    name: 'GBA LCD',
    description: 'Game Boy Advance LCD simulation with color correction',
    category: 'lcd',
    performance: 'low',
    path: 'shaders_slang/handheld/gba-color.slangp',
    settings: {
      darken_screen: 0.5,
      target_gamma: 2.2,
      display_gamma: 2.2,
      sat: 1.0,
      lum: 1.0,
      contrast: 1.0,
      blr: 0.0,
      blg: 0.0,
      blb: 0.0,
    },
  },
  'lcd-psp': {
    name: 'PSP LCD',
    description: 'PlayStation Portable LCD simulation',
    category: 'lcd',
    performance: 'low',
    path: 'shaders_slang/handheld/psp-color.slangp',
    settings: {},
  },

  // Upscaling/Smoothing
  'xbrz': {
    name: 'xBRZ',
    description: 'High-quality pixel art upscaling',
    category: 'upscale',
    performance: 'high',
    path: 'shaders_slang/xbrz/xbrz-freescale.slangp',
    settings: {
      XBR_SCALE: 4.0,
      XBR_Y_WEIGHT: 48.0,
      XBR_EQ_THRESHOLD: 25.0,
      XBR_LV2_COEFFICIENT: 2.0,
    },
  },
  'hqx': {
    name: 'HQ4x',
    description: 'Classic HQx pixel art upscaling filter',
    category: 'upscale',
    performance: 'medium',
    path: 'shaders_slang/hqx/hq4x.slangp',
    settings: {},
  },
  'scalefx': {
    name: 'ScaleFX',
    description: 'Smooth edge-aware upscaling',
    category: 'upscale',
    performance: 'high',
    path: 'shaders_slang/scalefx/scalefx.slangp',
    settings: {
      SFX_CLR: 0.5,
      SFX_SAA: 1.0,
    },
  },

  // Sharp/Clean
  'sharp-bilinear': {
    name: 'Sharp Bilinear',
    description: 'Clean scaling with minimal blur',
    category: 'clean',
    performance: 'low',
    path: 'shaders_slang/interpolation/sharp-bilinear.slangp',
    settings: {
      SHARP_BILINEAR_PRE_SCALE: 4.0,
      AUTO_PRESCALE: 1.0,
    },
  },
  'pixellate': {
    name: 'Pixellate',
    description: 'Integer scaling for pixel-perfect display',
    category: 'clean',
    performance: 'low',
    path: 'shaders_slang/interpolation/pixellate.slangp',
    settings: {},
  },

  // Special Effects
  'mega-bezel': {
    name: 'Mega Bezel',
    description: 'Complete CRT + bezel/frame simulation',
    category: 'special',
    performance: 'very-high',
    path: 'shaders_slang/bezel/Mega_Bezel/Presets/Base_CRT_Presets/MBZ__1__ADV__GDV.slangp',
    settings: {},
  },
};

// System-specific shader recommendations
const SYSTEM_SHADER_RECOMMENDATIONS: Record<string, string[]> = {
  NES: ['crt-lottes', 'ntsc-adaptive', 'crt-easymode'],
  SNES: ['crt-royale', 'blargg-ntsc', 'crt-guest-venom'],
  N64: ['crt-geom', 'sharp-bilinear'],
  GB: ['lcd-gameboy', 'pixellate'],
  GBC: ['lcd-gameboy', 'pixellate'],
  GBA: ['lcd-gba', 'sharp-bilinear', 'xbrz'],
  GENESIS: ['crt-lottes', 'ntsc-adaptive', 'crt-easymode'],
  MASTER_SYSTEM: ['crt-lottes', 'crt-easymode'],
  GAME_GEAR: ['lcd-gba', 'pixellate'],
  PS1: ['crt-royale', 'crt-guest-venom', 'xbrz'],
  PS2: ['sharp-bilinear', 'crt-geom'],
  PSP: ['lcd-psp', 'sharp-bilinear', 'xbrz'],
  DREAMCAST: ['crt-royale', 'sharp-bilinear'],
  SATURN: ['crt-lottes', 'crt-easymode'],
  GAMECUBE: ['sharp-bilinear'],
  WII: ['sharp-bilinear'],
  NDS: ['sharp-bilinear', 'pixellate', 'xbrz'],
  ARCADE: ['crt-royale', 'crt-lottes', 'mega-bezel'],
};

// Get all shader presets
router.get('/presets', authMiddleware, async (req: any, res) => {
  try {
    const { category, performance } = req.query;
    
    let presets = Object.entries(SHADER_PRESETS).map(([id, preset]) => ({
      id,
      ...preset,
    }));

    if (category) {
      presets = presets.filter(p => p.category === category);
    }
    if (performance) {
      presets = presets.filter(p => p.performance === performance);
    }

    res.json({
      presets,
      categories: ['crt', 'ntsc', 'lcd', 'upscale', 'clean', 'special'],
      performanceLevels: ['low', 'medium', 'high', 'very-high'],
    });
  } catch (error) {
    console.error('Presets error:', error);
    res.status(500).json({ error: 'Failed to get presets' });
  }
});

// Get shader preset details
router.get('/presets/:presetId', authMiddleware, async (req: any, res) => {
  try {
    const { presetId } = req.params;
    const preset = SHADER_PRESETS[presetId as keyof typeof SHADER_PRESETS];

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json({ id: presetId, ...preset });
  } catch (error) {
    console.error('Preset error:', error);
    res.status(500).json({ error: 'Failed to get preset' });
  }
});

// Get recommended shaders for a system
router.get('/recommendations/:system', authMiddleware, async (req: any, res) => {
  try {
    const { system } = req.params;
    const recommendations = SYSTEM_SHADER_RECOMMENDATIONS[system] || ['crt-easymode', 'sharp-bilinear'];

    const presets = recommendations
      .filter(id => SHADER_PRESETS[id as keyof typeof SHADER_PRESETS])
      .map(id => ({
        id,
        ...SHADER_PRESETS[id as keyof typeof SHADER_PRESETS],
      }));

    res.json({ system, presets });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Get user's saved shader configurations
router.get('/user-configs', authMiddleware, async (req: any, res) => {
  try {
    const configs = await prisma.userShaderConfig.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ configs });
  } catch (error) {
    console.error('User configs error:', error);
    res.status(500).json({ error: 'Failed to get configs' });
  }
});

// Save user shader configuration
router.post('/user-configs', authMiddleware, async (req: any, res) => {
  try {
    const { name, presetId, system, settings, isDefault } = req.body;

    if (!name || !presetId) {
      return res.status(400).json({ error: 'Name and preset required' });
    }

    // If marking as default, unset other defaults for this system
    if (isDefault && system) {
      await prisma.userShaderConfig.updateMany({
        where: { userId: req.user.id, system, isDefault: true },
        data: { isDefault: false },
      });
    }

    const config = await prisma.userShaderConfig.create({
      data: {
        userId: req.user.id,
        name,
        presetId,
        system: system || null,
        settings: settings || {},
        isDefault: isDefault || false,
      },
    });

    res.json({ config });
  } catch (error) {
    console.error('Save config error:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// Update user shader configuration
router.put('/user-configs/:configId', authMiddleware, async (req: any, res) => {
  try {
    const { configId } = req.params;
    const { name, settings, isDefault } = req.body;

    const existing = await prisma.userShaderConfig.findFirst({
      where: { id: configId, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Config not found' });
    }

    // If marking as default, unset other defaults
    if (isDefault && existing.system) {
      await prisma.userShaderConfig.updateMany({
        where: { 
          userId: req.user.id, 
          system: existing.system, 
          isDefault: true,
          id: { not: configId },
        },
        data: { isDefault: false },
      });
    }

    const config = await prisma.userShaderConfig.update({
      where: { id: configId },
      data: {
        name: name || existing.name,
        settings: settings || existing.settings,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault,
      },
    });

    res.json({ config });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Delete user shader configuration
router.delete('/user-configs/:configId', authMiddleware, async (req: any, res) => {
  try {
    const { configId } = req.params;

    const existing = await prisma.userShaderConfig.findFirst({
      where: { id: configId, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Config not found' });
    }

    await prisma.userShaderConfig.delete({ where: { id: configId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete config error:', error);
    res.status(500).json({ error: 'Failed to delete config' });
  }
});

// Get default shader for a system (user preference or system default)
router.get('/default/:system', authMiddleware, async (req: any, res) => {
  try {
    const { system } = req.params;

    // Check user's default for this system
    const userDefault = await prisma.userShaderConfig.findFirst({
      where: { userId: req.user.id, system, isDefault: true },
    });

    if (userDefault) {
      const preset = SHADER_PRESETS[userDefault.presetId as keyof typeof SHADER_PRESETS];
      return res.json({
        source: 'user',
        config: userDefault,
        preset: preset ? { id: userDefault.presetId, ...preset } : null,
      });
    }

    // Fall back to system recommendation
    const recommendations = SYSTEM_SHADER_RECOMMENDATIONS[system];
    const defaultPresetId = recommendations?.[0] || 'crt-easymode';
    const preset = SHADER_PRESETS[defaultPresetId as keyof typeof SHADER_PRESETS];

    res.json({
      source: 'system',
      presetId: defaultPresetId,
      preset: { id: defaultPresetId, ...preset },
    });
  } catch (error) {
    console.error('Default shader error:', error);
    res.status(500).json({ error: 'Failed to get default shader' });
  }
});

// Generate shader preset file for RetroArch
router.get('/generate/:presetId', authMiddleware, async (req: any, res) => {
  try {
    const { presetId } = req.params;
    const { settings } = req.query;

    const preset = SHADER_PRESETS[presetId as keyof typeof SHADER_PRESETS];
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Merge default settings with user settings
    const userSettings = settings ? JSON.parse(settings as string) : {};
    const mergedSettings = { ...preset.settings, ...userSettings };

    // Generate .slangp file content
    let content = `# EmuVerse Shader Preset: ${preset.name}\n`;
    content += `# Generated: ${new Date().toISOString()}\n\n`;
    content += `shaders = 1\n`;
    content += `shader0 = "${preset.path}"\n`;
    content += `filter_linear0 = false\n`;
    content += `wrap_mode0 = "clamp_to_border"\n`;
    content += `mipmap_input0 = false\n`;
    content += `alias0 = ""\n`;
    content += `float_framebuffer0 = "false"\n`;
    content += `srgb_framebuffer0 = "false"\n\n`;

    // Add parameters
    content += `# Parameters\n`;
    Object.entries(mergedSettings).forEach(([key, value]) => {
      content += `${key} = "${value}"\n`;
    });

    res.set({
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${presetId}.slangp"`,
    });

    res.send(content);
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: 'Failed to generate preset' });
  }
});

export default router;
export { SHADER_PRESETS, SYSTEM_SHADER_RECOMMENDATIONS };
