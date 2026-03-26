// ============================================================================
// 📐 SCAN PIPELINE CONFIGURATION
// All tunable parameters for document detection, scanning, and processing.
// ============================================================================

// === SHARED ===
export const SCAN_CONFIG = {
  // Target aspect ratio for BERRĪ notebook (5:3)
  TARGET_ASPECT_RATIO: 5.0 / 3.0,
  MAX_ASPECT_RATIO_DIFF: 1.5,
  MAX_SIDE_RATIO: 5.0,
};

// === useInferenceLogic.tsx — real-time frame processing ===
export const INFERENCE_CONFIG = {
  DEBUG_ON: false,
  FRAME_SKIP_INTERVAL: 1,
  MAX_PROCESS_DIMENSION: 4080,

  // Document detection — contour filter
  MIN_AREA_RATIO: 0.08,
  MAX_AREA_RATIO: 0.95,
  CROP_MARGIN_RATIO: 0.05,
  MIN_PORTRAIT_ASPECT_RATIO: 0.9,
  EPSILON_VALUES: [0.005, 0.01, 0.02, 0.05],

  // OpenCV edge detection
  GAUSSIAN_BLUR_KERNEL_SIZE: 3,
  CANNY_LOW: 50,
  CANNY_HIGH: 150,

  // Contour scoring
  SCORE_ASPECT_GOOD: 30,
  SCORE_ASPECT_OK: 15,
  SCORE_SOLIDITY_HIGH: 25,
  SCORE_SOLIDITY_MEDIUM: 15,
  SCORE_SOLIDITY_LOW: 5,
  SCORE_SIZE_LARGE: 20,
  SCORE_SIZE_MEDIUM: 10,

  // Stability & anti-flicker
  STABLE_DETECTION_THRESHOLD: 1,
  STABLE_NO_DETECTION_THRESHOLD: 20,
  REACTIVATE_AFTER_FRAMES: 150,

  // Brightness seeker
  SEEKER_MAX_POSITIVE: 250,
  SEEKER_MAX_NEGATIVE: 50,
  SEEKER_STEP: 1,
  BRIGHTNESS_CHANGE_INTERVAL: 1,
};

// === detectDocumentCorners.ts — corner detection on single image ===
export const CORNER_DETECTION_CONFIG = {
  FRAME_WIDTH: 720,
  FRAME_HEIGHT: 1280,
  MIN_AREA_RATIO: 0.001,
  MAX_AREA_RATIO: 0.95,
  MIN_DOCUMENT_AREA_RATIO: 0.10,
  ADAPTIVE_BLOCK_SIZE: 25,
  ADAPTIVE_C: 10,
  CANNY_LOW: 50,
  CANNY_HIGH: 150,
  BLUR_KERNEL: 5,
  MORPH_KERNEL: 2,
  EPSILON_VALUES: [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05],
};

// === scanDocument.ts — scan pipeline ===
export const SCAN_DOCUMENT_CONFIG = {
  // Output resolution (~300 DPI for BERRĪ notebook)
  TARGET_OUTPUT_WIDTH: 2100,
  TARGET_OUTPUT_HEIGHT: 3500,

  // Corner detection brightness fallbacks
  BRIGHTNESS_SETTINGS: [
    {alpha: 1.0, beta: 10, name: 'normal'},
    {alpha: 1.3, beta: 30, name: 'bright'},
    {alpha: 1.5, beta: 50, name: 'very-bright'},
    {alpha: 0.8, beta: -20, name: 'dark'},
  ],

  // Color mask — two-tier saturation thresholds
  COLOR_MASK: {
    TIER1_SAT_THRESHOLD: 80, // Vivid colors (red, pure blue/green)
    TIER1_MIN_CHANNEL_MAX: 100, // Tier1: max minChannel — real ink has at least one very dark channel
    TIER2_SAT_THRESHOLD: 50, // Medium-intensity colors (lighter greens, blues)
    NOT_PAPER_MIN_CHANNEL: 70, // Tier2: max minChannel to be ink (low = stricter paper filter) MENNYIRE SZINES
    BRIGHTNESS_FLOOR: 60, // Min maxChannel — must be visible
    WHITE_CEILING: 240, // Max maxChannel — exclude blown-out white
    DILATE_KERNEL_SIZE: 3, // Structuring element for dilating color mask
  },

  // White balance — correct paper color to pure white
  WHITE_BALANCE: {
    PAPER_BRIGHTNESS_MIN: 170, // Min brightness to be considered paper
    PAPER_SAT_MAX: 60, // Max saturation to be considered paper (yellow/beige paper can be 40-60)
    MIN_CORRECTION: 0.85, // Don't darken channels below this factor
    MAX_CORRECTION: 1.8, // Don't brighten channels above this factor
  },

  // Dark ink mask — adaptive threshold on maxChannel
  DARK_INK: {
    HIGH_RES_PIXEL_THRESHOLD: 3_000_000,
    BLOCK_SIZE_HIGH_RES: 51,
    BLOCK_SIZE_LOW_RES: 31,
    ADAPTIVE_C_HIGH_RES: 10,
    ADAPTIVE_C_LOW_RES: 10,
    LOW_SAT_THRESHOLD: 40, // Max saturation to be "dark ink" (not colored)
    ABSOLUTE_DARK_THRESHOLD: 130, // Max maxChannel to be "absolutely dark" — lower = fewer gray dots/shadows
    DILATE_KERNEL_SIZE: 3,
  },

  // Brightness detection
  BRIGHTNESS: {
    DAYLIGHT_THRESHOLD: 180,
    NORMAL_THRESHOLD: 120,
    OVEREXPOSURE_THRESHOLD: 230,
  },

  // Icon detection — bottom 5% strip, 7 columns
  ICONS: {
    BOTTOM_PADDING_RATIO: 0.01, // Padding from bottom edge
    STRIP_HEIGHT_RATIO: 0.05, // Height of icon detection strip
    MARGIN_RATIO: 2 / 12.5, // Left/right margin ratio (~16%)
    COLUMN_COUNT: 7,
    DARK_THRESHOLD: 2, // Min dark-pixel % to consider icon "active"
    PIXEL_DARK_VALUE: 100, // Grayscale threshold — below = "dark"
  },

  // QR code detection
  QR: {
    SEARCH_HEIGHT_RATIO: 0.15, // Bottom portion searched for QR
    BINARY_THRESHOLD: 100,
    MIN_SIZE_RATIO: 0.02, // Min QR bounding-box side
    MAX_SIZE_RATIO: 0.25, // Max QR bounding-box side
    ASPECT_RATIO_MIN: 0.7, // Min aspect ratio for "square"
    ASPECT_RATIO_MAX: 1.4, // Max aspect ratio for "square"
    CORNER_ZONE_RATIO: 0.3, // QR must be in left/right 30%
    BOTTOM_ZONE_RATIO: 0.5, // QR must be in bottom 50% of search strip
    FALLBACK_HEIGHT_RATIO: 0.90, // When no QR found, crop at this Y
  },

  // Final crop & height clamping
  CROP: {
    QR_MARGIN_RATIO: 0.01, // Margin subtracted from QR Y
    MIN_HEIGHT_RATIO: 0.88, // Floor clamp when QR detected
    MAX_HEIGHT_RATIO: 0.97, // Ceiling clamp when QR detected
    EDGE_CROP_PERCENT: 0.005, // Border trim on all sides (0.5%)
  },
};
