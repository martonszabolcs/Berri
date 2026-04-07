import { Platform } from 'react-native';

/**
 * Scan mask configuration - controls how aggressively masks detect content.
 *
 * BLACK MASK: Controls detection of dark text, pen strokes, background dots.
 *   - Higher adaptiveC → weaker mask (filters more noise/dots, but may lose light pencil)
 *   - Lower adaptiveC  → stronger mask (catches more detail, but picks up dots & noise)
 *
 * DARK INK MASK: Controls smooth preservation of dark ink strokes (non-thresholded).
 *   - Higher darkInkC           → weaker (fewer strokes detected as "ink")
 *   - Lower darkInkC            → stronger (more strokes preserved with tonal detail)
 *   - Higher absoluteDarkMax    → stronger (lighter grays also count as ink)
 *   - Lower absoluteDarkMax     → weaker (only very dark strokes)
 *
 * COLOR MASK: Controls detection of colored ink (pens, highlights, markers).
 *   - Higher satExcessThreshold → weaker (only vivid colors pass)
 *   - Lower satExcessThreshold  → stronger (subtle/pastel colors also detected)
 *   - Higher globalSatMin       → weaker (need more saturation to count)
 *   - Lower globalSatMin        → stronger (desaturated colors also pass)
 *   - Higher brightMin          → weaker (dark colored pixels ignored)
 *   - Lower brightMin           → stronger (dark colored pixels also detected)
 */

export interface ScanMaskConfig {
  // === BLACK MASK (adaptive threshold) ===
  /** Adaptive threshold C constant. Pixel must be C levels DARKER than local mean to be black.
   *  Range: 10–80. Default: 50. Higher = weaker (less noise), Lower = stronger (more detail). */
  blackMaskAdaptiveC: number;
  /** Adaptive threshold block size (must be odd). Larger = more robust to noise.
   *  High-res default: 51, low-res default: 31. */
  blackMaskBlockSizeHighRes: number;
  blackMaskBlockSizeLowRes: number;

  // === DARK INK MASK (smooth ink preservation) ===
  /** Dark ink adaptive threshold C. Higher = weaker. iOS default: 18, Android default: 10. */
  darkInkC_iOS: number;
  darkInkC_Android: number;
  /** Dark ink adaptive threshold C for low-res. iOS default: 10, Android default: 6. */
  darkInkCLowRes_iOS: number;
  darkInkCLowRes_Android: number;
  /** Absolute dark pixel max brightness. Pixels with maxChannel below this count as dark ink.
   *  Range: 80–200. Default: 145. Higher = stronger (catches lighter strokes). */
  darkInkAbsoluteDarkMax: number;
  /** Low saturation threshold for dark ink. Pixels with saturation below this are considered "not colored" → dark ink.
   *  Range: 20–80. Default: 40. Higher = more generous dark ink detection. */
  darkInkLowSatMax: number;
  /** Morphological opening kernel size to remove isolated dots from dark ink mask.
   *  High-res default: 5, low-res default: 3. */
  darkInkOpenKernelHighRes: number;
  darkInkOpenKernelLowRes: number;
  /** Dark ink darkening factor (0.0–1.0). Multiplied with original pixel brightness.
   *  Default: 0.9. Lower = darker ink in output. */
  darkInkDarkenFactor: number;

  // === COLOR MASK (colored ink/highlight detection) ===
  /** Local saturation excess threshold. Pixel must have this much MORE saturation than local average.
   *  Range: 3–40. Default: 18. Higher = weaker (only vivid). */
  colorMaskSatExcessThreshold: number;
  /** Global minimum saturation. Absolute saturation must be at least this to count.
   *  Range: 5–50. Default: 18. Higher = weaker. */
  colorMaskGlobalSatMin: number;
  /** Minimum brightness (maxChannel) for a pixel to be considered colored.
   *  Range: 30–120. Default: 60. Higher = weaker (ignores dark colors). */
  colorMaskBrightMin: number;
  /** Maximum brightness (minChannel) — above this = white paper, not color.
   *  Range: 180–240. Default: 220. Lower = stricter white rejection. */
  colorMaskWhiteMax: number;
  /** Direct global saturation threshold — pixels with saturation above this are ALWAYS colored,
   *  bypassing local excess test. Preserves large uniformly-colored areas (stickers, logos, stamps).
   *  Range: 0 (everything) – 80 (only very vivid). Default: 0 (disabled). */
  colorMaskGlobalSatDirect: number;
  /** Gaussian blur kernel size for local saturation baseline.
   *  Default: 51. Larger = wider context for "local average". */
  colorMaskLocalBlurSize: number;
  /** Soft blending Gaussian blur kernel size for color mask edges.
   *  Default: 5. Larger = softer color-to-BW transition. */
  colorMaskSoftBlendSize: number;
}

/** Default scan mask configuration */
export const DEFAULT_SCAN_MASK_CONFIG: ScanMaskConfig = {
  // Black mask
  blackMaskAdaptiveC: 50,
  blackMaskBlockSizeHighRes: 51,
  blackMaskBlockSizeLowRes: 31,

  // Dark ink mask
  darkInkC_iOS: 18,
  darkInkC_Android: 10,
  darkInkCLowRes_iOS: 10,
  darkInkCLowRes_Android: 6,
  darkInkAbsoluteDarkMax: 145,
  darkInkLowSatMax: 40,
  darkInkOpenKernelHighRes: 5,
  darkInkOpenKernelLowRes: 3,
  darkInkDarkenFactor: 0.9,

  // Color mask
  colorMaskSatExcessThreshold: 18,
  colorMaskGlobalSatMin: 18,
  colorMaskBrightMin: 60,
  colorMaskWhiteMax: 220,
  colorMaskGlobalSatDirect: 0,
  colorMaskLocalBlurSize: 51,
  colorMaskSoftBlendSize: 5,
};

/**
 * Runtime mutable config. Import and modify to change mask behavior at runtime.
 *
 * Example:
 *   import { scanMaskConfig } from './scanConfig';
 *   scanMaskConfig.blackMaskAdaptiveC = 35;  // stronger black mask
 *   scanMaskConfig.colorMaskSatExcessThreshold = 10; // catch more colors
 */
export const scanMaskConfig: ScanMaskConfig = { ...DEFAULT_SCAN_MASK_CONFIG };

/** Reset all mask config values to defaults */
export const resetScanMaskConfig = () => {
  Object.assign(scanMaskConfig, DEFAULT_SCAN_MASK_CONFIG);
};

/**
 * User-facing scan quality levels (1–10).
 * These map to the technical parameters via linear interpolation.
 */
export interface ScanQualityLevels {
  blackLevel: number; // 1–10, default 5
  colorLevel: number; // 1–10, default 5
}

export const DEFAULT_QUALITY_LEVELS: ScanQualityLevels = {
  blackLevel: 5,
  colorLevel: 10,
};

/** Linear interpolation helper */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Piecewise lerp: level 1-5 maps min→default, level 5-10 maps default→max.
 * Guarantees level 5 = exactly the default value.
 */
const piecewiseLerp = (min: number, def: number, max: number, level: number) => {
  if (level <= 5) {
    return lerp(min, def, (level - 1) / 4);
  } else {
    return lerp(def, max, (level - 5) / 5);
  }
};

/**
 * Extended piecewise lerp for 1–15 range.
 * Level 1 = min, level 10 = def ("strong default"), level 15 = max (extreme).
 */
const piecewiseLerp15 = (min: number, def: number, max: number, level: number) => {
  if (level <= 10) {
    return lerp(min, def, (level - 1) / 9);
  } else {
    return lerp(def, max, (level - 10) / 5);
  }
};

/**
 * Apply user-friendly quality levels (1–10) to the scan mask config.
 * Level 1 = weak (less noise, may lose faint content)
 * Level 5 = default (matches DEFAULT_SCAN_MASK_CONFIG exactly)
 * Level 10 = strong (catches everything, more noise)
 */
export const applyScanQualityPreset = (levels: ScanQualityLevels) => {
  const bl = levels.blackLevel;
  const cl = levels.colorLevel;

  // Black mask: adaptiveC: 70 (weak/1) → 50 (default/5) → 20 (strong/10)
  scanMaskConfig.blackMaskAdaptiveC = Math.round(piecewiseLerp(70, 50, 20, bl));

  // Dark ink: absoluteDarkMax: 100 (weak/1) → 145 (default/5) → 200 (strong/10)
  scanMaskConfig.darkInkAbsoluteDarkMax = Math.round(piecewiseLerp(100, 145, 200, bl));

  // Dark ink C iOS: 12 (weak/1) → 18 (default/5) → 28 (strong/10)
  scanMaskConfig.darkInkC_iOS = Math.round(piecewiseLerp(12, 18, 28, bl));

  // Dark ink C Android: 6 (weak/1) → 10 (default/5) → 18 (strong/10)
  scanMaskConfig.darkInkC_Android = Math.round(piecewiseLerp(6, 10, 18, bl));

  // Dark ink darken factor: 0.95 (weak/1) → 0.9 (default/5) → 0.75 (strong/10)
  scanMaskConfig.darkInkDarkenFactor = piecewiseLerp(0.95, 0.9, 0.75, bl);

  // Color mask: satExcess: 40 (weak/1) → 3 (default/10) → 1 (extreme/15)
  scanMaskConfig.colorMaskSatExcessThreshold = Math.round(piecewiseLerp15(40, 3, 1, cl));

  // Color mask: globalSatMin: 40 (weak/1) → 5 (default/10) → 2 (extreme/15)
  scanMaskConfig.colorMaskGlobalSatMin = Math.round(piecewiseLerp15(40, 5, 2, cl));

  // Color mask: brightMin: 100 (weak/1) → 30 (default/10) → 15 (extreme/15)
  scanMaskConfig.colorMaskBrightMin = Math.round(piecewiseLerp15(100, 30, 15, cl));
};

/**
 * Advanced scan settings — user-friendly 1–10 levels.
 * null = use value from simple preset (blackLevel/colorLevel).
 * All scales: 1 = weakest, 5 ≈ default, 10 = strongest.
 */
export interface AdvancedScanSettings {
  detailSensitivity: number | null;    // 1–10: Fine detail capture (faint pencil, small dots)
  lightStrokeCapture: number | null;   // 1–10: Keep light/faint strokes
  outputDarkness: number | null;       // 1–10: How dark the ink appears in result
  colorDetection: number | null;       // 1–10: Color sensitivity
  darkColorCapture: number | null;     // 1–10: Keep dark-colored writing (dark blue, brown)
  paperTolerance: number | null;       // 1–10: Handle off-white/yellowed paper
  largeColorAreas: number | null;      // 1–10: Keep stickers, stamps, logos (1=off)
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedScanSettings = {
  detailSensitivity: null,
  lightStrokeCapture: null,
  outputDarkness: null,
  colorDetection: null,
  darkColorCapture: null,
  paperTolerance: null,
  largeColorAreas: null,
};

/**
 * Apply advanced overrides on top of current scanMaskConfig.
 * Maps user-friendly 1–10 levels to raw technical values.
 * Only non-null values are applied.
 */
export const applyAdvancedOverrides = (adv: AdvancedScanSettings) => {
  // Detail sensitivity: 1→adaptiveC=70(weak), 5→50(default), 10→20(strong, inverted)
  if (adv.detailSensitivity !== null) {
    scanMaskConfig.blackMaskAdaptiveC = Math.round(piecewiseLerp(70, 50, 20, adv.detailSensitivity));
  }
  // Light stroke capture: 1→darkMax=80(weak), 5→145(default), 10→200(strong)
  if (adv.lightStrokeCapture !== null) {
    scanMaskConfig.darkInkAbsoluteDarkMax = Math.round(piecewiseLerp(80, 145, 200, adv.lightStrokeCapture));
  }
  // Output darkness: 1→factor=1.0(light), 5→0.9(default), 10→0.5(very dark, inverted)
  if (adv.outputDarkness !== null) {
    scanMaskConfig.darkInkDarkenFactor = Math.round(piecewiseLerp(1.0, 0.9, 0.5, adv.outputDarkness) * 100) / 100;
  }
  // Color detection: 1→satExcess=40(weak), 5→18(default), 10→3(strong, inverted)
  if (adv.colorDetection !== null) {
    scanMaskConfig.colorMaskSatExcessThreshold = Math.round(piecewiseLerp(40, 18, 3, adv.colorDetection));
  }
  // Dark color capture: 1→brightMin=120(weak), 5→60(default), 10→30(strong, inverted)
  if (adv.darkColorCapture !== null) {
    scanMaskConfig.colorMaskBrightMin = Math.round(piecewiseLerp(120, 60, 30, adv.darkColorCapture));
  }
  // Paper tolerance: 1→whiteMax=180(strict), 5→220(default), 10→240(tolerant)
  if (adv.paperTolerance !== null) {
    scanMaskConfig.colorMaskWhiteMax = Math.round(piecewiseLerp(180, 220, 240, adv.paperTolerance));
  }
  // Large color areas: 1=off(0), 2→satDirect=80(very selective), 5→40, 10→5(catches everything)
  if (adv.largeColorAreas !== null) {
    if (adv.largeColorAreas <= 1) {
      scanMaskConfig.colorMaskGlobalSatDirect = 0;
    } else {
      scanMaskConfig.colorMaskGlobalSatDirect = Math.round(piecewiseLerp(80, 40, 5, adv.largeColorAreas));
    }
  }
};
