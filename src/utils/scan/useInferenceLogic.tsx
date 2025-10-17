import {
  OpenCV,
  ObjectType,
  ColorConversionCodes,
  RetrievalModes,
  ContourApproximationModes,
  MorphTypes,
  MorphShapes,
  AdaptiveThresholdTypes,
  ThresholdTypes,
  DataTypes,
} from 'react-native-fast-opencv';
import { useFrameProcessor } from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useBarcodeScanner } from 'react-native-vision-camera-barcodes-scanner';
import { useEffect } from 'react';

// ============================================================================
// 🎯 FŐBB KONFIGURÁCIÓK - DOKUMENTUM DETEKTÁLÁS
// ============================================================================

// === TELJESÍTMÉNY ÉS DEBUG ===
const DEBUG_ON = true; // Debug képek generálása (false = jobb teljesítmény!)
const FRAME_SKIP_INTERVAL = 1; // Minden N. frame feldolgozása (1=minden, 2=minden második)
const DEBUG_IMAGE_INTERVAL = 6; // Debug kép generálási gyakoriság (ha DEBUG_ON=true)

// === KÉPFELDOLGOZÁS ===
const MAX_PROCESS_DIMENSION = 1080; // Max feldolgozási felbontás (1080*2 = 2160px)

// === BLUR (HOMÁLYOSSÁG) DETEKTÁLÁS ===
const BLUR_THRESHOLD = 20; // Laplacian variance küszöb (alacsonyabb = homályos)

// === DOKUMENTUM MÉRET KORLÁTOK ===
const MIN_AREA_RATIO = 0.1; // Min dokumentum terület a kép %-ában (10%)
const MAX_AREA_RATIO = 0.95; // Max dokumentum terület a kép %-ában (95%)
const CROP_MARGIN_RATIO = 0.05; // Szélek margin aránya (5% - képszél elutasítás)

// === ASPECT RATIO (OLDALARÁNY) KÖVETELMÉNYEK ===
const MIN_PORTRAIT_ASPECT_RATIO = 0.9; // Minimum álló téglalap arány (width/height < 0.9)
// 0.9 = majdnem négyzet is OK, 0.77 = 1.3x magasabb kell, 0.6 = 5:3 arány

// === DOKUMENTUM VALIDÁLÁS (validateDocumentPerspective) ===
const TARGET_ASPECT_RATIO = 5.0 / 3.0; // Cél aspect ratio (5:3 = 1.667)
const MAX_ASPECT_RATIO_DIFF = 1.5; // Max eltérés cél aspect ratio-tól (korrekció triggerelés)
const MAX_HORIZONTAL_RATIO = 5.0; // Max felső/alsó oldal arány (perspektíva torzítás)
const MAX_VERTICAL_RATIO = 5.0; // Max bal/jobb oldal arány (perspektíva torzítás)

// === STABILITÁS ÉS ANTI-VILLOGÁS ===
const STABLE_DETECTION_THRESHOLD = 5; // Hány egymást követő frame kell a stabil detektáláshoz
const STABLE_NO_DETECTION_THRESHOLD = 15; // Hány frame kell a "nincs dokumentum" státuszhoz
const REACTIVATE_AFTER_FRAMES = 15; // Frozen state újraaktiválás N frame után

// === BRIGHTNESS SEEKER (FÉNYERŐ KALIBRÁLÁS) ===
const BRIGHTNESS_SEEKER_MAX_OFFSET = 100; // Max offset értéke (+-100)
const BRIGHTNESS_SEEKER_STEP = 20; // Lépésköz (20 per lépés)
const BRIGHTNESS_CHANGE_INTERVAL = 1; // Fényerő váltás gyakorisága (frame-ekben)

// === OPENCV PARAMÉTEREK ===
const ADAPTIVE_THRESHOLD_BLOCK_SIZE = 25; // Adaptív threshold blokk méret
const ADAPTIVE_THRESHOLD_C = 10; // Adaptív threshold C konstans
const BINARY_THRESHOLD = 100; // Egyszerű threshold érték
const CANNY_THRESHOLD_LOW = 50; // Canny él detektálás alsó küszöb
const CANNY_THRESHOLD_HIGH = 150; // Canny él detektálás felső küszöb
const GAUSSIAN_BLUR_KERNEL_SIZE = 5; // Gaussian blur kernel méret (5x5)
const MORPHOLOGY_KERNEL_SIZE = 5; // Morfológiai műveletek kernel méret (5x5)

// === CONTOUR (KÖRVONAL) APPROXIMÁCIÓ ===
const EPSILON_VALUES = [0.005, 0.01, 0.02, 0.05]; // Epsilon szorzók polygon approximációhoz

// === PONTOZÁSI RENDSZER (Score calculation) ===
// Aspect ratio pontok
const SCORE_ASPECT_GOOD = 30; // Aspect ratio 0.2-8.0 között
const SCORE_ASPECT_OK = 15; // Aspect ratio 0.1-15.0 között

// Solidity (tömörség) pontok
const SCORE_SOLIDITY_HIGH = 25; // Solidity > 0.3
const SCORE_SOLIDITY_MEDIUM = 15; // Solidity > 0.2
const SCORE_SOLIDITY_LOW = 5; // Solidity > 0.1

// Méret pontok
const SCORE_SIZE_LARGE = 20; // MinDim > 8% képméret
const SCORE_SIZE_MEDIUM = 10; // MinDim > 4% képméret

// ============================================================================

interface DocumentCorner {
  x: number;
  y: number;
}

export interface DetectionResult {
  corners: DocumentCorner[]; // Screen koordináták
  processedCorners?: DocumentCorner[]; // Processing koordináták (rotált képhez) - scan-hez
  confidence: number;
  debugImage?: string;
  brightness?: number;
  seekerInfo?: string;
  qrInfo?: string;
  qrPosition?: 'left' | 'right' | null; // QR kód pozíciója a dokumentumon (alul, bal vagy jobb oldal)
  qrBounds?: { left: number; top: number; width: number; height: number } | null; // QR kód pontos bounds (frame koordinátákban)
  blurInfo?: string; // Homályosság információ
  frameWidth?: number; // Frame natív szélessége
  frameHeight?: number; // Frame natív magassága
  calibrationInfo?: {
    darkThreshold: number;
    brightThreshold: number;
    frameCount: number;
    range: number;
    average: number;
  };
}

interface BrightnessCalibration {
  minSeen: number;
  maxSeen: number;
  frameCount: number;
  history: number[];
}

let brightnessCalibration: BrightnessCalibration = {
  minSeen: 255,
  maxSeen: 0,
  frameCount: 0,
  history: [],
};

const getDeviceSpecificDefaults = (
  b: number,
): { darkThreshold: number; brightThreshold: number } => {
  'worklet';
  return b < 30
    ? { darkThreshold: 15, brightThreshold: 120 }
    : b > 50
    ? { darkThreshold: 60, brightThreshold: 150 }
    : { darkThreshold: 40, brightThreshold: 140 };
};

const getAdaptiveBrightnessThresholds = (
  currentBrightness: number,
  calibration: BrightnessCalibration,
): {
  darkThreshold: number;
  brightThreshold: number;
  calibrationInfo: {
    darkThreshold: number;
    brightThreshold: number;
    frameCount: number;
    range: number;
    average: number;
  };
} => {
  'worklet';
  calibration.minSeen = Math.min(calibration.minSeen, currentBrightness);
  calibration.maxSeen = Math.max(calibration.maxSeen, currentBrightness);
  calibration.frameCount++;
  calibration.history.push(currentBrightness);
  if (calibration.history.length > 50) calibration.history.shift();

  if (calibration.frameCount < 5) {
    const deviceDefaults = getDeviceSpecificDefaults(currentBrightness);
    const currentAverage =
      calibration.history.length > 0
        ? calibration.history.reduce((sum, val) => sum + val, 0) /
          calibration.history.length
        : currentBrightness;
    return {
      ...deviceDefaults,
      calibrationInfo: {
        darkThreshold: deviceDefaults.darkThreshold,
        brightThreshold: deviceDefaults.brightThreshold,
        frameCount: calibration.frameCount,
        range: calibration.maxSeen - calibration.minSeen,
        average: currentAverage,
      },
    };
  }

  const range = calibration.maxSeen - calibration.minSeen;
  const avg =
    calibration.history.length > 0
      ? calibration.history.reduce((sum, val) => sum + val, 0) /
        calibration.history.length
      : currentBrightness;

  let darkThreshold: number, brightThreshold: number;
  if (range < 30) {
    const offset = avg < 50 ? 35 : 25;
    darkThreshold = Math.max(calibration.minSeen, avg - offset);
    brightThreshold = Math.min(calibration.maxSeen, avg + offset);
  } else {
    darkThreshold = calibration.minSeen + range * 0.2;
    brightThreshold = calibration.minSeen + range * 0.8;
  }

  return {
    darkThreshold,
    brightThreshold,
    calibrationInfo: {
      darkThreshold,
      brightThreshold,
      frameCount: calibration.frameCount,
      range,
      average: avg,
    },
  };
};

const calculateDistance = (p1: DocumentCorner, p2: DocumentCorner): number => {
  'worklet';
  const dx = p1.x - p2.x,
    dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};
const orderCorners = (corners: DocumentCorner[]): DocumentCorner[] => {
  'worklet';
  if (corners.length !== 4) return corners;

  const cornersWithSum = corners.map(c => ({
    ...c,
    sum: c.x + c.y,
    diff: c.x - c.y,
  }));
  const topLeft = cornersWithSum.reduce((min, curr) =>
    curr.sum < min.sum ? curr : min,
  );
  const bottomRight = cornersWithSum.reduce((max, curr) =>
    curr.sum > max.sum ? curr : max,
  );
  const topRight = cornersWithSum.reduce((min, curr) =>
    curr.diff < min.diff ? curr : min,
  );
  const bottomLeft = cornersWithSum.reduce((max, curr) =>
    curr.diff > max.diff ? curr : max,
  );

  return [
    { x: topLeft.x, y: topLeft.y },
    { x: topRight.x, y: topRight.y },
    { x: bottomRight.x, y: bottomRight.y },
    { x: bottomLeft.x, y: bottomLeft.y },
  ];
};

// Helper function to validate document perspective and correct rectangle if needed
const validateDocumentPerspective = (
  corners: DocumentCorner[],
): {
  isValid: boolean;
  correctedCorners?: DocumentCorner[];
} => {
  'worklet';
  if (corners.length !== 4) {
    return {
      isValid: false,
    };
  }

  const ordered = orderCorners(corners);

  // Calculate current aspect ratio with safety checks
  const width =
    (calculateDistance(ordered[0], ordered[1]) +
      calculateDistance(ordered[3], ordered[2])) /
    2;
  const height =
    (calculateDistance(ordered[0], ordered[3]) +
      calculateDistance(ordered[1], ordered[2])) /
    2;

  // Safety check: avoid division by zero
  if (width < 1 || height < 1) {
    return {
      isValid: false,
    };
  }

  const currentAspectRatio = height / width;

  // Target aspect ratio is 5:3 = 1.667
  const targetAspectRatio = TARGET_ASPECT_RATIO;
  const aspectRatioDiff = Math.abs(currentAspectRatio - targetAspectRatio);

  // SOKKAL ENGEDÉKENYEBB - perspective esetén a ratio nagyon eltérhet
  if (aspectRatioDiff > MAX_ASPECT_RATIO_DIFF) {
    // Növelve 0.4-ről 1.5-re - nagy perspektíva torzításhoz
    const correctedCorners = correctToRectangle(ordered);
    return {
      isValid: true,
      correctedCorners,
    };
  }

  // ENGEDÉKENYEBB side ratio check perspektíva torzításokhoz
  const topSide = calculateDistance(ordered[0], ordered[1]);
  const bottomSide = calculateDistance(ordered[3], ordered[2]);
  const leftSide = calculateDistance(ordered[0], ordered[3]);
  const rightSide = calculateDistance(ordered[1], ordered[2]);

  const horizontalRatio =
    Math.max(topSide, bottomSide) / Math.min(topSide, bottomSide);
  const verticalRatio =
    Math.max(leftSide, rightSide) / Math.min(leftSide, rightSide);

  // SOKKAL ENGEDÉKENYEBB perspektíva torzítás - oldalirányú nézés esetén
  if (
    horizontalRatio > MAX_HORIZONTAL_RATIO ||
    verticalRatio > MAX_VERTICAL_RATIO
  ) {
    // Növelve 2.5-ről 5.0-re
    const correctedCorners = correctToRectangle(ordered);
    return {
      isValid: true,
      correctedCorners,
    };
  }

  // Minden esetben valid
  return { isValid: true };
};

// Helper function to correct corners to form a proper rectangle with 5:3 aspect ratio
const correctToRectangle = (corners: DocumentCorner[]): DocumentCorner[] => {
  'worklet';
  const [tl, tr, br, bl] = corners;
  const targetAspectRatio = TARGET_ASPECT_RATIO;
  const centerX = (tl.x + tr.x + br.x + bl.x) * 0.25;
  const centerY = (tl.y + tr.y + br.y + bl.y) * 0.25;
  const avgWidth =
    (calculateDistance(tl, tr) + calculateDistance(bl, br)) * 0.5;
  const avgHeight =
    (calculateDistance(tl, bl) + calculateDistance(tr, br)) * 0.5;

  let finalWidth, finalHeight;
  if (avgHeight / avgWidth > targetAspectRatio) {
    finalHeight = avgHeight;
    finalWidth = finalHeight / targetAspectRatio;
  } else {
    finalWidth = avgWidth;
    finalHeight = finalWidth * targetAspectRatio;
  }

  const halfWidth = finalWidth * 0.5;
  const halfHeight = finalHeight * 0.5;

  return [
    { x: centerX - halfWidth, y: centerY - halfHeight },
    { x: centerX + halfWidth, y: centerY - halfHeight },
    { x: centerX + halfWidth, y: centerY + halfHeight },
    { x: centerX - halfWidth, y: centerY + halfHeight },
  ];
};

export const useInferenceLogic = (
  onInference: (detections: DetectionResult[]) => void,
  screenWidth: number,
  screenHeight: number,
  isProcessingEnabled: boolean = true, // Új paraméter - frame processing engedélyezése
) => {
  const onInferenceJS = Worklets.createRunOnJS(onInference);
  const { resize } = useResizePlugin();
  const { scanBarcodes } = useBarcodeScanner(['qr']); // QR kód scanner!
  
  // Shared value a worklet számára - ez reaktívan frissül!
  const isProcessingEnabledShared = useSharedValue(isProcessingEnabled);
  
  // Frissítsd a shared value-t amikor változik a prop
  useEffect(() => {
    isProcessingEnabledShared.value = isProcessingEnabled;
  }, [isProcessingEnabled, isProcessingEnabledShared]);

  // BRIGHTNESS SEEKER STATE - component scope-ban, hogy perzisztens legyen!
  const seekerState = {
    isActive: true,
    direction: 'up' as 'up' | 'down',
    currentOffset: 0,
    maxOffset: BRIGHTNESS_SEEKER_MAX_OFFSET,
    step: BRIGHTNESS_SEEKER_STEP,
    isCompletelyDone: false,
    finalAlpha: 1.0,
    finalBeta: 0,
    noDocumentCounter: 0,
    frameCounter: 0, // Új: frame számláló az optimalizáláshoz
    debugFrameCounter: 0, // Debug image frame számláló
    consecutiveDetections: 0, // ANTI-VILLOGÁS: hány egymást követő frame-ben láttuk
    consecutiveNoDetections: 0, // ANTI-VILLOGÁS: hány egymást követő frame-ben NEM láttuk
    isStableDetection: false, // ANTI-VILLOGÁS: stabil-e a detektálás
    frameSkipCounter: 0, // Frame skip számláló - csak minden 10. frame-et dolgozunk fel
  };

  // === DEBUG FLAG - PERFORMANCE OPTIMALIZÁLÁS ===
  const DEBUG_ON_RUNTIME = DEBUG_ON; // false = nincs debug kép, jobb teljesítmény!

  const REACTIVATE_AFTER_FRAMES_RUNTIME = REACTIVATE_AFTER_FRAMES;
  const BRIGHTNESS_CHANGE_INTERVAL_RUNTIME = BRIGHTNESS_CHANGE_INTERVAL; // Csak minden 5. frame-nél változtassunk
  const DEBUG_IMAGE_INTERVAL_RUNTIME = DEBUG_IMAGE_INTERVAL; // Csak minden 3. frame-nél generáljunk debug image-t
  const STABLE_DETECTION_THRESHOLD_RUNTIME = STABLE_DETECTION_THRESHOLD; // 5 egymást követő frame kell a stabil detektáláshoz - garantálja, hogy éles a kép
  const STABLE_NO_DETECTION_THRESHOLD_RUNTIME = STABLE_NO_DETECTION_THRESHOLD; // 3 egymást követő frame kell a "nincs dokumentum" állapothoz
  const FRAME_SKIP_INTERVAL_RUNTIME = FRAME_SKIP_INTERVAL; // Minden frame-et feldolgozunk (1 = nincs skip, smooth canvas)

  // === KERNEL CACHE - OPTIMALIZÁLÁS! ===
  // Kerneleket csak egyszer hozzuk létre, nem minden frame-en!
  let cachedKernel5x5: any = null;
  let cachedKsize5x5: any = null;

  const getKernel5x5 = () => {
    'worklet';
    if (!cachedKernel5x5) {
      const kernelSize = OpenCV.createObject(
        ObjectType.Size,
        MORPHOLOGY_KERNEL_SIZE,
        MORPHOLOGY_KERNEL_SIZE,
      );
      cachedKernel5x5 = OpenCV.invoke(
        'getStructuringElement',
        MorphShapes.MORPH_RECT,
        kernelSize,
      );
    }
    return cachedKernel5x5;
  };

  const getKsize5x5 = () => {
    'worklet';
    if (!cachedKsize5x5) {
      cachedKsize5x5 = OpenCV.createObject(
        ObjectType.Size,
        GAUSSIAN_BLUR_KERNEL_SIZE,
        GAUSSIAN_BLUR_KERNEL_SIZE,
      );
    }
    return cachedKsize5x5;
  };

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      
      // ⏸️ Ha fotózás van folyamatban, ne dolgozzuk fel a frame-et!
      if (!isProcessingEnabledShared.value) {
        return; // Skip processing during photo capture
      }

      // FRAME SKIP - csak minden N. frame-et dolgozunk fel
      seekerState.frameSkipCounter++;
      if (seekerState.frameSkipCounter % FRAME_SKIP_INTERVAL_RUNTIME !== 0) {
        return; // Átugorjuk ezt a frame-et
      }

      try {
        // QR KÓD DETEKTÁLÁS - csak info céllal, nem szól bele a detektálásba
        const qrCodes = scanBarcodes(frame);
        let qrDebugInfo = '';
        let qrPosition: 'left' | 'right' | null = null;
        let qrBounds: { left: number; top: number; width: number; height: number } | null = null;

        if (qrCodes && qrCodes.length > 0) {
          const qr = qrCodes[0];
          // Barcode type: { bottom, height, left, rawValue, right, top, width }
          // Számítsuk ki a QR kód közepét a bounding box alapján
          const centerX = qr.left + qr.width / 2;
          const centerY = qr.top + qr.height / 2;
          
          // Mentjük a bounds-ot
          qrBounds = {
            left: qr.left,
            top: qr.top,
            width: qr.width,
            height: qr.height
          };
          
          // QR kód pozíció meghatározása: bal vagy jobb oldal
          // FONTOS: Barcode scanner a landscape frame-en fut (pl. 1280x720)
          // A kép utána 90° óramutató szerint lesz forgatva portrait-ra (720x1280)
          // 90° forgatásnál: landscape ALSÓ rész → portrait BAL oldal
          //                  landscape FELSŐ rész → portrait JOBB oldal
          // Ezért Y koordináta alapján döntünk (nem X)!
          const frameCenter = frame.height / 2; // Y irány közepe (landscape frame magassága)
          qrPosition = centerY > frameCenter ? 'left' : 'right';
          
          qrDebugInfo = `QR:✓ ${qrPosition.toUpperCase()} @${Math.round(centerX)},${Math.round(centerY)} "${qr.rawValue}"`;
        } else {
          qrDebugInfo = 'QR:✗ Nincs';
        }

        // Inline updateBrightnessSeeker logic
        const updateBrightnessSeeker = (
          documentFound: boolean,
        ): { alpha: number; beta: number } => {
          'worklet';

          if (documentFound) {
            // DOKUMENTUM TALÁLVA - befagyasztás
            seekerState.isActive = false;
            seekerState.isCompletelyDone = true;

            if (seekerState.currentOffset > 0) {
              const factor = seekerState.currentOffset / 100;
              seekerState.finalAlpha = 1.0 + factor * 0.8;
              seekerState.finalBeta = factor * 40;
            } else if (seekerState.currentOffset < 0) {
              const factor = Math.abs(seekerState.currentOffset) / 100;
              seekerState.finalAlpha = 1.0 - factor * 0.3;
              seekerState.finalBeta = -(factor * 30);
            } else {
              seekerState.finalAlpha = 1.0;
              seekerState.finalBeta = 0;
            }

            return {
              alpha: seekerState.finalAlpha,
              beta: seekerState.finalBeta,
            };
          }

          // NINCS DOKUMENTUM - pásztázás folytatása/előreléptetés
          seekerState.isActive = true;

          // Frame számláló növelése
          seekerState.frameCounter++;

          // ADAPTÍV LÉPÉSMÉRET - rossz fényviszonyok esetén gyorsabb váltás
          let currentStep = seekerState.step;
          const offsetAbs = Math.abs(seekerState.currentOffset);
          
          // Ha már elértük a -80 vagy +80 szélsőségeket, de még mindig nincs detektálás
          // akkor DRASZTIKUSAN megnöveljük a lépésméretet
          if (offsetAbs >= 80) {
            currentStep = 40; // 20-ról 40-re - kétszer gyorsabb pásztázás
          } else if (offsetAbs >= 60) {
            currentStep = 30; // Közepes gyorsítás
          }

          // Csak minden BRIGHTNESS_CHANGE_INTERVAL frame-nél változtassunk a fényerőn
          if (seekerState.frameCounter >= BRIGHTNESS_CHANGE_INTERVAL_RUNTIME) {
            seekerState.frameCounter = 0; // Reset számláló

            if (seekerState.direction === 'up') {
              seekerState.currentOffset += currentStep;
              if (seekerState.currentOffset > seekerState.maxOffset) {
                seekerState.direction = 'down';
                seekerState.currentOffset = seekerState.maxOffset;
              }
            } else {
              seekerState.currentOffset -= currentStep;
              if (seekerState.currentOffset < -seekerState.maxOffset) {
                seekerState.direction = 'up';
                seekerState.currentOffset = -seekerState.maxOffset;
              }
            }
            
            // Frissítsük a step értéket a debug info számára
            seekerState.step = currentStep;
          }

          // Számítsuk ki az új alpha/beta értéket
          if (seekerState.currentOffset > 0) {
            const factor = seekerState.currentOffset / seekerState.maxOffset;
            return { alpha: 1.0 + factor * 0.8, beta: factor * 40 };
          } else if (seekerState.currentOffset < 0) {
            const factor =
              Math.abs(seekerState.currentOffset) / seekerState.maxOffset;
            return { alpha: 1.0 - factor * 0.3, beta: -(factor * 30) };
          }

          return { alpha: 1.0, beta: 0 };
        };

        const getCurrentBrightnessSettings = (): {
          alpha: number;
          beta: number;
        } => {
          'worklet';
          const offset = seekerState.currentOffset;
          if (offset > 0) {
            const factor = offset / seekerState.maxOffset;
            return { alpha: 1.0 + factor * 0.8, beta: factor * 40 };
          }
          if (offset < 0) {
            const factor = Math.abs(offset) / seekerState.maxOffset;
            return { alpha: 1.0 - factor * 0.3, beta: -(factor * 30) };
          }
          return { alpha: 1.0, beta: 0 };
        };

        // Downscale frame for faster processing while preserving aspect ratio
        const maxProcessDimension = MAX_PROCESS_DIMENSION; // Optimalizált de még mindig jó minőség
        let processWidth: number;
        let processHeight: number;

        // Calculate scale factor to fit within maxProcessDimension
        const maxDimension = Math.max(frame.width, frame.height);
        if (maxDimension > maxProcessDimension) {
          const scaleFactor = maxProcessDimension / maxDimension;
          processWidth = Math.round(frame.width * scaleFactor);
          processHeight = Math.round(frame.height * scaleFactor);
        } else {
          processWidth = frame.width;
          processHeight = frame.height;
        }

        // Pre-calculate rotated dimensions (90° rotation swaps width/height)
        const rotatedHeight = processWidth;
        const rotatedWidth = processHeight;

        // Use resize plugin to convert frame to buffer format (no actual resizing, just format conversion)
        const resized = resize(frame, {
          dataType: 'uint8',
          pixelFormat: 'bgr',
          scale: {
            height: processHeight,
            width: processWidth,
          },
        });

        // Create Mat from the frame buffer
        const srcMat = OpenCV.frameBufferToMat(
          processHeight,
          processWidth,
          3,
          resized,
        );

        // Rotate image 90 degrees clockwise (optimized: in-place rotation)
        OpenCV.invoke('rotate', srcMat, srcMat, 0); // ROTATE_90_CLOCKWISE = 0, in-place rotation

        // Convert to grayscale
        const gray = OpenCV.createObject(
          ObjectType.Mat,
          rotatedHeight,
          rotatedWidth,
          DataTypes.CV_8UC1,
        );

        OpenCV.invoke(
          'cvtColor',
          srcMat,
          gray,
          ColorConversionCodes.COLOR_BGR2GRAY,
        );

        // BLUR DETECTION - Laplacian variance módszer
        // Számítsuk ki a Laplacian variance-t a gray képen
        const laplacian = OpenCV.createObject(
          ObjectType.Mat,
          rotatedHeight,
          rotatedWidth,
          DataTypes.CV_64F,
        );
        // Laplacian(src, dst, ddepth, ksize, scale, delta, borderType)
        // ksize=1 (3x3 kernel), scale=1, delta=0, borderType=4 (BORDER_DEFAULT)
        OpenCV.invoke(
          'Laplacian',
          gray,
          laplacian,
          DataTypes.CV_64F,
          1,
          1,
          0,
          4,
        );

        // Számítsuk ki a mean és stddev-et - Mat objektumokat vár (1x4 mérettel)
        const meanMat = OpenCV.createObject(
          ObjectType.Mat,
          1,
          4,
          DataTypes.CV_64F,
        );
        const stdDevMat = OpenCV.createObject(
          ObjectType.Mat,
          1,
          4,
          DataTypes.CV_64F,
        );
        OpenCV.invoke('meanStdDev', laplacian, meanMat, stdDevMat);

        // Konvertáljuk a stdDevMat-ot olvasható formára
        const stdDevScalar = OpenCV.invoke('mean', stdDevMat);
        const stdDevData = OpenCV.toJSValue(stdDevScalar);
        const stdDev = stdDevData.a || 0; // Az első komponens
        const variance = stdDev * stdDev; // variance = stdDev^2

        // Threshold: ha variance < BLUR_THRESHOLD, akkor homályos
        const isBlurry = variance < BLUR_THRESHOLD;

        // Blur info string létrehozása
        const blurInfo = isBlurry
          ? `Blur:⚠️ ${variance.toFixed(1)}`
          : `Blur:✓ ${variance.toFixed(1)}`;

        const meanResult = OpenCV.invoke('mean', gray);
        const meanData = OpenCV.toJSValue(meanResult);
        const meanBrightness = meanData.a;

        const adaptiveResult = getAdaptiveBrightnessThresholds(
          meanBrightness,
          brightnessCalibration,
        );

        const brightened = OpenCV.createObject(
          ObjectType.Mat,
          rotatedHeight,
          rotatedWidth,
          DataTypes.CV_8UC1,
        );

        // Ha túl sokáig nem találunk dokumentumot active scanning közben, ne reset-eljük!
        // Ez a limit csak arra való, hogy ne legyen végtelen loop
        // (Ezt a blokkot ELTÁVOLÍTJUK, mert felesleges és kárt okoz)

        // Határozd meg a JELENLEGI frame alpha/beta értékeit
        let alpha: number;
        let beta: number;
        let documentFoundInThisFrame = false;

        if (seekerState.isCompletelyDone) {
          // FROZEN state - használd a befagyasztott értékeket
          alpha = seekerState.finalAlpha;
          beta = seekerState.finalBeta;
        } else {
          // ACTIVE scanning - használd a JELENLEGI offset alapján számított értékeket
          const currentSettings = getCurrentBrightnessSettings();
          alpha = currentSettings.alpha;
          beta = currentSettings.beta;
        }

        OpenCV.invoke('convertScaleAbs', gray, brightened, alpha, beta);
        const cropMarginW = Math.floor(rotatedWidth * CROP_MARGIN_RATIO);
        const cropMarginH = Math.floor(rotatedHeight * CROP_MARGIN_RATIO);

        const imgArea = rotatedWidth * rotatedHeight;
        const minArea = imgArea * MIN_AREA_RATIO;
        const maxArea = imgArea * MAX_AREA_RATIO;

        const enhanced = OpenCV.createObject(
          ObjectType.Mat,
          rotatedHeight,
          rotatedWidth,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke(
          'adaptiveThreshold',
          brightened,
          enhanced,
          255,
          AdaptiveThresholdTypes.ADAPTIVE_THRESH_MEAN_C,
          ThresholdTypes.THRESH_BINARY,
          ADAPTIVE_THRESHOLD_BLOCK_SIZE, // Növelve 21-ről 25-re - jobb detektálás
          ADAPTIVE_THRESHOLD_C,
        );

        const binary = OpenCV.createObject(
          ObjectType.Mat,
          rotatedHeight,
          rotatedWidth,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke(
          'threshold',
          brightened,
          binary,
          BINARY_THRESHOLD,
          255,
          ThresholdTypes.THRESH_BINARY,
        );

        const blurred = OpenCV.createObject(
          ObjectType.Mat,
          rotatedHeight,
          rotatedWidth,
          DataTypes.CV_8UC1,
        );
        const ksize = getKsize5x5(); // CACHE-ELT KERNEL!
        OpenCV.invoke('GaussianBlur', brightened, blurred, ksize, 0);

        const kernel = getKernel5x5(); // CACHE-ELT KERNEL!

        // OPTIMALIZÁLÁS: morphClosed helyett újrahasználjuk binary-t!
        OpenCV.invoke(
          'morphologyEx',
          binary,
          binary, // in-place! ugyanaz a Mat input és output
          MorphTypes.MORPH_CLOSE,
          kernel,
        );

        const edges = OpenCV.createObject(
          ObjectType.Mat,
          rotatedHeight,
          rotatedWidth,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke(
          'Canny',
          blurred,
          edges,
          CANNY_THRESHOLD_LOW,
          CANNY_THRESHOLD_HIGH,
        ); // Balanced - jó detektálás és sebesség

        // OPTIMALIZÁLÁS: combined helyett újrahasználjuk edges-t!
        OpenCV.invoke('bitwise_or', binary, edges, edges); // in-place! edges = binary OR edges

        // 7. Find contours
        const contours = OpenCV.createObject(ObjectType.MatVector);

        OpenCV.invoke(
          'findContours',
          edges, // combined helyett edges (in-place optimalizálás!)
          contours,
          RetrievalModes.RETR_EXTERNAL,
          ContourApproximationModes.CHAIN_APPROX_SIMPLE,
        );

        // Debug: Log contour detection results
        const contoursData = OpenCV.toJSValue(contours);
        const contoursSize = contoursData.array.length;

        // 8. Process contours to find black notebook border (ignore outer 10%)
        let documentContour = null;
        let maxValidArea = 0;
        let bestContourScore = 0;

        for (let i = 0; i < contoursSize; i++) {
          const contour = OpenCV.copyObjectFromVector(contours, i);
          const areaResult = OpenCV.invoke('contourArea', contour);
          const area = areaResult.value;

          // Check if contour has appropriate size for notebook
          if (area > minArea && area < maxArea) {
            // Get bounding rectangle to check if contour is within valid region
            const boundingRect = OpenCV.invoke('boundingRect', contour);
            const rectData = OpenCV.toJSValue(boundingRect);

            // Skip contours that touch or are too close to the frame edges (outer 5%)
            if (
              rectData.x <= cropMarginW ||
              rectData.y <= cropMarginH ||
              rectData.x + rectData.width >= rotatedWidth - cropMarginW ||
              rectData.y + rectData.height >= rotatedHeight - cropMarginH
            ) {
              continue;
            }

            // Calculate contour properties for notebook detection
            const perimeterResult = OpenCV.invoke('arcLength', contour, true);
            const perimeter = perimeterResult.value;
            const aspectRatio = rectData.width / rectData.height;

            // CSAK ÁLLÓ TÉGLALAP - magasság legyen nagyobb mint szélesség
            // Minimum 1.3x magasabb legyen (aspect ratio < 0.77)
            if (aspectRatio >= MIN_PORTRAIT_ASPECT_RATIO) {
              continue; // Skip négyzet és fekvő téglalapok
            }

            // Calculate solidity approximation using bounding rectangle
            const boundingArea = rectData.width * rectData.height;
            const solidity = area / boundingArea; // Approximation without convex hull

            // Try different epsilon values for polygon approximation - OPTIMALIZÁLT!
            // Csökkentve 6-ról 3-ra a legfontosabb értékekkel
            const epsilonValues = EPSILON_VALUES; // 50% gyorsabb!

            for (const epsMult of epsilonValues) {
              const epsilon = epsMult * perimeter;
              const approx = OpenCV.createObject(ObjectType.PointVector);
              OpenCV.invoke('approxPolyDP', contour, approx, epsilon, true);

              // Check if we have approximately 4 corners - ENGEDÉKENYEBB perspektívához
              const approxData = OpenCV.toJSValue(approx);
              const cornerCount = approxData.array.length;

              // Accept ONLY 4 corners - gyorsabb, pontosabb
              if (cornerCount === 4) {
                // Score calculation
                let score = (area / imgArea) * 100;

                if (aspectRatio > 0.2 && aspectRatio < 8.0) {
                  score += SCORE_ASPECT_GOOD;
                } else if (aspectRatio > 0.1 && aspectRatio < 15.0) {
                  score += SCORE_ASPECT_OK;
                }

                if (solidity > 0.3) {
                  score += SCORE_SOLIDITY_HIGH;
                } else if (solidity > 0.2) {
                  score += SCORE_SOLIDITY_MEDIUM;
                } else if (solidity > 0.1) {
                  score += SCORE_SOLIDITY_LOW;
                }

                const minDim = Math.min(rectData.width, rectData.height);
                if (
                  minDim > rotatedWidth * 0.08 &&
                  minDim > rotatedHeight * 0.08
                ) {
                  score += SCORE_SIZE_LARGE;
                } else if (
                  minDim > rotatedWidth * 0.04 &&
                  minDim > rotatedHeight * 0.04
                ) {
                  score += SCORE_SIZE_MEDIUM;
                }

                // QR KÓD - csak info céllal, nem ad bonuszt a detektáláshoz

                if (score > bestContourScore) {
                  documentContour = approx;
                  maxValidArea = area;
                  bestContourScore = score;
                }
                break; // OPTIMALIZÁLÁS: Ha 4 sarokkal megtaláltuk, kilépünk az epsilon loop-ból!
              } // cornerCount === 4 close
            } // epsilon loop close
          } // area check close
        } // contour loop close

        // 9. Process found notebook contour
        if (documentContour) {
          // NE reseteljük itt a számlálót - csak akkor ha tényleg érvényes dokumentum van!

          // Extract corners from contour
          const contourData = OpenCV.toJSValue(documentContour);

          // Keep processing coordinates for validation and visualization
          const processingCorners: DocumentCorner[] = contourData.array.map(
            point => ({
              x: point.x,
              y: point.y,
            }),
          );

          if (processingCorners.length === 4) {
            const validation = validateDocumentPerspective(processingCorners);

            if (validation.isValid) {
              // Use corrected corners if available, otherwise use original
              const finalProcessingCorners =
                validation.correctedCorners || processingCorners;

              // Order corners in processing coordinates first
              const orderedProcessingCorners = orderCorners(
                finalProcessingCorners,
              );

              // Corners are in rotatedWidth x rotatedHeight coordinates (after 90° rotation)
              // Need to account for resizeMode="cover" crop

              // Camera gives landscape frame, we rotate to portrait
              // Frame: 1280x720 → Rotate 90°: 720x1280
              // Screen: 393x852 (different aspect ratio!)
              // resizeMode="cover" will crop the frame to fit screen

              // Calculate how the rotated frame is cropped to fit the screen
              const rotatedAspect = rotatedWidth / rotatedHeight; // e.g., 1280/720 = 1.778
              const screenAspect = screenWidth / screenHeight; // e.g., 393/852 = 0.461

              let cropOffsetX = 0;
              let cropOffsetY = 0;
              let visibleWidth = rotatedWidth;
              let visibleHeight = rotatedHeight;

              if (rotatedAspect > screenAspect) {
                // Frame is wider than screen (relative to height) - crop sides
                visibleWidth = rotatedHeight * screenAspect;
                cropOffsetX = (rotatedWidth - visibleWidth) / 2;
              } else {
                // Frame is taller than screen (relative to width) - crop top/bottom
                visibleHeight = rotatedWidth / screenAspect;
                cropOffsetY = (rotatedHeight - visibleHeight) / 2;
              }

              // Transform coordinates: processing → screen (accounting for crop)
              const screenScaleX = screenWidth / visibleWidth;
              const screenScaleY = screenHeight / visibleHeight;

              let orderedCorners = orderedProcessingCorners.map(p => ({
                x: Math.round((p.x - cropOffsetX) * screenScaleX),
                y: Math.round((p.y - cropOffsetY) * screenScaleY),
              }));

              // UPSCALE koordináták a TELJES FELBONTÁSÚ képhez (scan-hez)
              // Processing: processWidth x processHeight → Rotate: rotatedWidth x rotatedHeight
              // Full Res: frame.width x frame.height → Rotate: frame.height x frame.width
              const fullResRotatedWidth = frame.height; // 90° rotation után
              const fullResRotatedHeight = frame.width;

              const scaleX = fullResRotatedWidth / rotatedWidth;
              const scaleY = fullResRotatedHeight / rotatedHeight;

              // Upscale-elt processing koordináták (teljes felbontás)
              const orderedProcessingCornersFullRes =
                orderedProcessingCorners.map(p => ({
                  x: Math.round(p.x * scaleX),
                  y: Math.round(p.y * scaleY),
                }));

              // DEBUG KÉP GENERÁLÁS - CSAK HA DEBUG_ON === true
              let visualBase64 = { base64: '' };

              if (DEBUG_ON_RUNTIME) {
                // Növeljük a debug frame számlálót
                seekerState.debugFrameCounter++;

                // Csak minden N-edik frame-nél generáljunk debug image-t - PERFORMANCE BOOST!
                if (
                  seekerState.debugFrameCounter >= DEBUG_IMAGE_INTERVAL_RUNTIME
                ) {
                  seekerState.debugFrameCounter = 0;

                  // Create debug visualization on the combined processing image (black/white with contours)
                  // Convert the combined image (used for contour detection) to RGB for visualization
                  const debugVisualImage = OpenCV.createObject(
                    ObjectType.Mat,
                    rotatedHeight,
                    rotatedWidth,
                    DataTypes.CV_8UC3,
                  );
                  // Convert single channel to 3-channel for color drawing
                  OpenCV.invoke(
                    'cvtColor',
                    edges, // combined helyett edges (in-place optimalizálás!)
                    debugVisualImage,
                    ColorConversionCodes.COLOR_GRAY2RGB,
                  );

                  // Draw corners with different colors (RGB format now)
                  const colors = [
                    OpenCV.createObject(ObjectType.Scalar, 255, 0, 0), // Red - Top-left
                    OpenCV.createObject(ObjectType.Scalar, 0, 255, 0), // Green - Top-right
                    OpenCV.createObject(ObjectType.Scalar, 0, 0, 255), // Blue - Bottom-right
                    OpenCV.createObject(ObjectType.Scalar, 255, 255, 0), // Yellow - Bottom-left
                  ];

                  // Use the final corrected corners for visualization
                  for (let i = 0; i < orderedProcessingCorners.length; i++) {
                    const corner = orderedProcessingCorners[i];
                    const point = OpenCV.createObject(
                      ObjectType.Point,
                      Math.round(corner.x),
                      Math.round(corner.y),
                    );

                    // Draw circle at corner position
                    OpenCV.invoke(
                      'circle',
                      debugVisualImage,
                      point,
                      24, // Növelve 8-ról 24-re (3x nagyobb)
                      colors[i],
                      -1,
                      8,
                    ); // LineTypes.LINE_8 = 8
                  }

                  // Draw contour lines connecting the corners
                  // Draw lines connecting the corners
                  const contourColor = OpenCV.createObject(
                    ObjectType.Scalar,
                    0,
                    0,
                    255,
                  ); // Blue
                  for (let i = 0; i < orderedProcessingCorners.length; i++) {
                    const currentCorner = orderedProcessingCorners[i];
                    const nextCorner =
                      orderedProcessingCorners[
                        (i + 1) % orderedProcessingCorners.length
                      ];

                    const pt1 = OpenCV.createObject(
                      ObjectType.Point,
                      Math.round(currentCorner.x),
                      Math.round(currentCorner.y),
                    );
                    const pt2 = OpenCV.createObject(
                      ObjectType.Point,
                      Math.round(nextCorner.x),
                      Math.round(nextCorner.y),
                    );

                    OpenCV.invoke(
                      'line',
                      debugVisualImage,
                      pt1,
                      pt2,
                      contourColor,
                      6, // Növelve 2-ről 6-ra (3x vastagabb)
                      8,
                    ); // LineTypes.LINE_8 = 8
                  }

                  // Output the visualization with the 4 corner points on processed image
                  visualBase64 = OpenCV.toJSValue(debugVisualImage);
                }
              }

              seekerState.noDocumentCounter = 0;
              documentFoundInThisFrame = true;

              // ANTI-VILLOGÁS: Számoljuk az egymást követő detektálásokat
              seekerState.consecutiveDetections++;
              seekerState.consecutiveNoDetections = 0;

              // Csak akkor fogadjuk el stabilan, ha legalább N egymást követő frame-ben látjuk
              if (
                seekerState.consecutiveDetections >=
                STABLE_DETECTION_THRESHOLD_RUNTIME
              ) {
                seekerState.isStableDetection = true;
              }

              // DOKUMENTUM TALÁLVA ÉS STABIL - befagyasztjuk az aktuális értékeket
              if (
                seekerState.isStableDetection &&
                !seekerState.isCompletelyDone
              ) {
                // Első alkalommal találtuk meg STABILAN - befagyasztjuk AZONNAL
                const freezeResult = updateBrightnessSeeker(true);
                alpha = freezeResult.alpha;
                beta = freezeResult.beta;
              } else if (seekerState.isCompletelyDone) {
                // Már korábban befagyasztottuk - használjuk a tárolt értékeket
                alpha = seekerState.finalAlpha;
                beta = seekerState.finalBeta;
              }

              // Csak stabil detektálás esetén küldjük el az eredményt
              if (seekerState.isStableDetection) {
                const result: DetectionResult = {
                  corners: orderedCorners, // Screen koordináták
                  processedCorners: orderedProcessingCornersFullRes, // TELJES FELBONTÁSÚ Processing koordináták - scan-hez
                  confidence: Math.min(maxValidArea / (imgArea * 0.2), 1.0), // Confidence based on area - csökkentve 0.5-ről 0.2-re
                  debugImage: visualBase64.base64, // Add the base64 debug image
                  brightness: meanBrightness,
                  frameWidth: frame.width, // Natív frame szélesség
                  frameHeight: frame.height, // Natív frame magasság
                  seekerInfo: `A:${alpha.toFixed(2).padStart(4)} B:${beta
                    .toFixed(0)
                    .padStart(3)}\nS:${
                    seekerState.isActive ? 'ON ' : 'OFF'
                  } O:${seekerState.currentOffset.toString().padStart(4)} D:${
                    seekerState.direction === 'up' ? 'up  ' : 'down'
                  }\nST:${seekerState.step
                    .toString()
                    .padStart(2)} NC:${seekerState.noDocumentCounter
                    .toString()
                    .padStart(2)}/${REACTIVATE_AFTER_FRAMES} FROZEN:${
                    seekerState.isCompletelyDone ? 'Y' : 'N'
                  }`,
                  qrInfo: qrDebugInfo,
                  qrPosition: qrPosition, // QR kód pozíciója (left/right/null)
                  qrBounds: qrBounds, // QR kód pontos bounds (frame koordinátákban)
                  blurInfo: blurInfo,
                  calibrationInfo: adaptiveResult.calibrationInfo,
                };

                onInferenceJS([result]);
              }
            } else {
              // Invalid perspective - debug kép csak ha DEBUG_ON
              let visualBase64 = { base64: '' };

              if (DEBUG_ON_RUNTIME) {
                // Create debug visualization on the combined processing image without corners
                const debugVisualImage = OpenCV.createObject(
                  ObjectType.Mat,
                  rotatedHeight,
                  rotatedWidth,
                  DataTypes.CV_8UC3,
                );
                // Convert single channel to 3-channel for visualization
                OpenCV.invoke(
                  'cvtColor',
                  edges, // combined helyett edges
                  debugVisualImage,
                  ColorConversionCodes.COLOR_GRAY2RGB,
                );

                visualBase64 = OpenCV.toJSValue(debugVisualImage);
              }

              const result: DetectionResult = {
                corners: [],
                confidence: 0,
                debugImage: visualBase64.base64,
                brightness: meanBrightness,
                seekerInfo: `A:${alpha.toFixed(2).padStart(4)} B:${beta
                  .toFixed(0)
                  .padStart(3)}\nS:${
                  seekerState.isActive ? 'ON ' : 'OFF'
                } O:${seekerState.currentOffset.toString().padStart(4)} D:${
                  seekerState.direction === 'up' ? 'up  ' : 'down'
                }\nST:${seekerState.step
                  .toString()
                  .padStart(2)} NC:${seekerState.noDocumentCounter
                  .toString()
                  .padStart(2)}/${REACTIVATE_AFTER_FRAMES_RUNTIME} FROZEN:${
                  seekerState.isCompletelyDone ? 'Y' : 'N'
                }`,
                qrInfo: qrDebugInfo,
                qrPosition: qrPosition,
                qrBounds: qrBounds,
                blurInfo: blurInfo,
                calibrationInfo: adaptiveResult.calibrationInfo,
              };

              onInferenceJS([result]);
            }
          } else {
            // Not exactly 4 corners found - FREEZE brightness seeking
            // Befagyasztjuk a seekert amikor nem 4 sarok van
            seekerState.isActive = false;
            seekerState.isCompletelyDone = true;

            if (seekerState.currentOffset > 0) {
              const factor = seekerState.currentOffset / 100;
              seekerState.finalAlpha = 1.0 + factor * 0.8;
              seekerState.finalBeta = factor * 40;
            } else if (seekerState.currentOffset < 0) {
              const factor = Math.abs(seekerState.currentOffset) / 100;
              seekerState.finalAlpha = 1.0 - factor * 0.3;
              seekerState.finalBeta = -(factor * 30);
            } else {
              seekerState.finalAlpha = 1.0;
              seekerState.finalBeta = 0;
            }

            seekerState.noDocumentCounter = 0;
            documentFoundInThisFrame = true; // Jelezzük hogy "találtunk valamit" hogy ne pásztázzon tovább

            // Debug kép csak ha DEBUG_ON
            let visualBase64 = { base64: '' };

            if (DEBUG_ON_RUNTIME) {
              // Create debug visualization on the combined processing image without corners
              const debugVisualImage = OpenCV.createObject(
                ObjectType.Mat,
                rotatedHeight,
                rotatedWidth,
                DataTypes.CV_8UC3,
              );
              // Convert single channel to 3-channel for visualization
              OpenCV.invoke(
                'cvtColor',
                edges, // combined helyett edges
                debugVisualImage,
                ColorConversionCodes.COLOR_GRAY2RGB,
              );
              visualBase64 = OpenCV.toJSValue(debugVisualImage);
            }

            const result: DetectionResult = {
              corners: [],
              confidence: 0,
              debugImage: visualBase64.base64,
              brightness: meanBrightness,
              seekerInfo: `A:${alpha.toFixed(2).padStart(4)} B:${beta
                .toFixed(0)
                .padStart(3)}\nS:${
                seekerState.isActive ? 'ON ' : 'OFF'
              } O:${seekerState.currentOffset.toString().padStart(4)} D:${
                seekerState.direction === 'up' ? 'up  ' : 'down'
              }\nST:${seekerState.step
                .toString()
                .padStart(2)} NC:${seekerState.noDocumentCounter
                .toString()
                .padStart(2)}/${REACTIVATE_AFTER_FRAMES} FROZEN:${
                seekerState.isCompletelyDone ? 'Y' : 'N'
              }`,
              qrInfo: qrDebugInfo,
              qrPosition: qrPosition,
              qrBounds: qrBounds,
              blurInfo: blurInfo,
              calibrationInfo: adaptiveResult.calibrationInfo,
            };

            onInferenceJS([result]);
            //OpenCV.clearBuffers();
          }
        } else {
          // No notebook found - debug kép csak ha DEBUG_ON
          let visualBase64 = { base64: '' };

          if (DEBUG_ON_RUNTIME) {
            // Create debug visualization on the combined processing image
            const debugVisualImage = OpenCV.createObject(
              ObjectType.Mat,
              rotatedHeight,
              rotatedWidth,
              DataTypes.CV_8UC3,
            );
            // Convert single channel to 3-channel for visualization
            OpenCV.invoke(
              'cvtColor',
              edges, // combined helyett edges
              debugVisualImage,
              ColorConversionCodes.COLOR_GRAY2RGB,
            );

            visualBase64 = OpenCV.toJSValue(debugVisualImage);
          }

          const result: DetectionResult = {
            corners: [],
            confidence: 0,
            debugImage: visualBase64.base64,
            brightness: meanBrightness,
            seekerInfo: `A:${alpha.toFixed(2).padStart(4)} B:${beta
              .toFixed(0)
              .padStart(3)}\nS:${
              seekerState.isActive ? 'ON ' : 'OFF'
            } O:${seekerState.currentOffset.toString().padStart(4)} D:${
              seekerState.direction === 'up' ? 'up  ' : 'down'
            }\nST:${seekerState.step
              .toString()
              .padStart(2)} NC:${seekerState.noDocumentCounter
              .toString()
              .padStart(2)}/${REACTIVATE_AFTER_FRAMES} FROZEN:${
              seekerState.isCompletelyDone ? 'Y' : 'N'
            }`,
            qrInfo: qrDebugInfo,
            qrPosition: qrPosition,
            qrBounds: qrBounds,
            blurInfo: blurInfo,
            calibrationInfo: adaptiveResult.calibrationInfo,
          };

          onInferenceJS([result]);
        }

        // Frame végén: ANTI-VILLOGÁS és seeker logika
        if (!documentFoundInThisFrame) {
          // Nincs dokumentum ebben a frame-ben
          seekerState.consecutiveDetections = 0;
          seekerState.consecutiveNoDetections++;

          // Ha elég sokáig nem látjuk, akkor már nem stabil
          if (
            seekerState.consecutiveNoDetections >=
            STABLE_NO_DETECTION_THRESHOLD_RUNTIME
          ) {
            seekerState.isStableDetection = false;
          }

          // Ha a seeker aktív, lépjünk tovább
          if (!seekerState.isCompletelyDone) {
            updateBrightnessSeeker(false);
          }
        }

        // Frozen state timeout kezelés - ha nincs dokumentum 15 frame-ig
        if (!documentFoundInThisFrame && seekerState.isCompletelyDone) {
          seekerState.noDocumentCounter++;

          if (
            seekerState.noDocumentCounter >= REACTIVATE_AFTER_FRAMES_RUNTIME
          ) {
            seekerState.isActive = true;
            seekerState.isCompletelyDone = false;

            seekerState.direction = 'up';
            seekerState.currentOffset = 0;
            seekerState.noDocumentCounter = 0;
            seekerState.step = BRIGHTNESS_SEEKER_STEP; // Alapértelmezett lépésméret visszaállítása
          } else {
          }
        }

        // Clean up matrices to prevent memory leaks
        OpenCV.clearBuffers();
      } catch (error) {
        // Silent error handling for better performance
        const result: DetectionResult = {
          corners: [],
          confidence: 0,
          brightness: 0,
          seekerInfo: 'ERROR',
          qrInfo: 'QR:ERROR',
          qrPosition: null,
          calibrationInfo: {
            darkThreshold: 80,
            brightThreshold: 160,
            frameCount: 0,
            range: 0,
            average: 0,
          },
        };

        onInferenceJS([result]);

        // Clean up on error too
        OpenCV.clearBuffers();
      }
    },
    [screenWidth, screenHeight],
  );

  return { frameProcessor };
};
