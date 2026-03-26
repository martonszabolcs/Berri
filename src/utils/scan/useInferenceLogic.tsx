import {
  OpenCV,
  ObjectType,
  ColorConversionCodes,
  RetrievalModes,
  ContourApproximationModes,
  MorphTypes,
  MorphShapes,
  DataTypes,
} from 'react-native-fast-opencv';
import {useFrameProcessor} from 'react-native-vision-camera';
import {Worklets, useSharedValue} from 'react-native-worklets-core';
import {useResizePlugin} from 'vision-camera-resize-plugin';
import {useBarcodeScanner} from 'react-native-vision-camera-barcodes-scanner';
import {useEffect} from 'react';
import {SCAN_CONFIG, INFERENCE_CONFIG} from './scanConfig';

// === CONFIGURATION (from scanConfig.ts) ===
const {
  DEBUG_ON,
  FRAME_SKIP_INTERVAL,
  MAX_PROCESS_DIMENSION,
  MIN_AREA_RATIO,
  MAX_AREA_RATIO,
  CROP_MARGIN_RATIO,
  MIN_PORTRAIT_ASPECT_RATIO,
  EPSILON_VALUES,
  GAUSSIAN_BLUR_KERNEL_SIZE,
  CANNY_LOW,
  CANNY_HIGH,
  SCORE_ASPECT_GOOD,
  SCORE_ASPECT_OK,
  SCORE_SOLIDITY_HIGH,
  SCORE_SOLIDITY_MEDIUM,
  SCORE_SOLIDITY_LOW,
  SCORE_SIZE_LARGE,
  SCORE_SIZE_MEDIUM,
  STABLE_DETECTION_THRESHOLD,
  STABLE_NO_DETECTION_THRESHOLD,
  REACTIVATE_AFTER_FRAMES,
  SEEKER_MAX_POSITIVE,
  SEEKER_MAX_NEGATIVE,
  SEEKER_STEP,
  BRIGHTNESS_CHANGE_INTERVAL,
} = INFERENCE_CONFIG;
const { TARGET_ASPECT_RATIO, MAX_ASPECT_RATIO_DIFF, MAX_SIDE_RATIO } = SCAN_CONFIG;

interface DocumentCorner {
  x: number;
  y: number;
}

export interface DetectionResult {
  corners: DocumentCorner[];
  processedCorners?: DocumentCorner[];
  confidence: number;
  debugImage?: string;
  brightness?: number;
  seekerInfo?: string;
  qrInfo?: string;
  qrValue?: string | null;
  qrPosition?: 'left' | 'right' | null;
  qrBounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  blurInfo?: string;
  perspectiveWarning?: string | null;
  frameWidth?: number;
  frameHeight?: number;
  calibrationInfo?: {
    darkThreshold: number;
    brightThreshold: number;
    frameCount: number;
    range: number;
    average: number;
  };
}

// === BRIGHTNESS CALIBRATION (module-level, persists across frames) ===
let brightnessCalibration = {
  minSeen: 255,
  maxSeen: 0,
  frameCount: 0,
  history: [] as number[],
};

// === WORKLET HELPERS ===

const calculateDistance = (a: DocumentCorner, b: DocumentCorner): number => {
  'worklet';
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
};

const areCornersStable = (
  current: DocumentCorner[],
  previous: DocumentCorner[] | null,
  maxJump: number = 30,
): boolean => {
  'worklet';
  if (!previous || previous.length !== 4 || current.length !== 4) return true;
  for (let i = 0; i < 4; i++) {
    if (calculateDistance(current[i], previous[i]) > maxJump) return false;
  }
  return true;
};

const orderCorners = (corners: DocumentCorner[]): DocumentCorner[] => {
  'worklet';
  if (corners.length !== 4) return corners;
  const wm = corners.map(c => ({...c, sum: c.x + c.y, diff: c.x - c.y}));
  const tl = wm.reduce((a, b) => (b.sum < a.sum ? b : a));
  const br = wm.reduce((a, b) => (b.sum > a.sum ? b : a));
  const tr = wm.reduce((a, b) => (b.diff < a.diff ? b : a));
  const bl = wm.reduce((a, b) => (b.diff > a.diff ? b : a));
  return [
    {x: tl.x, y: tl.y},
    {x: tr.x, y: tr.y},
    {x: br.x, y: br.y},
    {x: bl.x, y: bl.y},
  ];
};

const correctToRectangle = (corners: DocumentCorner[]): DocumentCorner[] => {
  'worklet';
  const [tl, tr, br, bl] = corners;
  const cx = (tl.x + tr.x + br.x + bl.x) * 0.25;
  const cy = (tl.y + tr.y + br.y + bl.y) * 0.25;
  const avgW = (calculateDistance(tl, tr) + calculateDistance(bl, br)) * 0.5;
  const avgH = (calculateDistance(tl, bl) + calculateDistance(tr, br)) * 0.5;
  let w: number, h: number;
  if (avgH / avgW > TARGET_ASPECT_RATIO) {
    h = avgH;
    w = h / TARGET_ASPECT_RATIO;
  } else {
    w = avgW;
    h = w * TARGET_ASPECT_RATIO;
  }
  const hw = w * 0.5,
    hh = h * 0.5;
  return [
    {x: cx - hw, y: cy - hh},
    {x: cx + hw, y: cy - hh},
    {x: cx + hw, y: cy + hh},
    {x: cx - hw, y: cy + hh},
  ];
};

const validatePerspective = (
  corners: DocumentCorner[],
): {
  isValid: boolean;
  correctedCorners?: DocumentCorner[];
  qualityScore: number;
  isPoorQuality: boolean;
  perspectiveWarning: string | null;
} => {
  'worklet';
  if (corners.length !== 4) {
    return {
      isValid: false,
      qualityScore: 0,
      isPoorQuality: true,
      perspectiveWarning: null,
    };
  }

  const ordered = orderCorners(corners);
  const w =
    (calculateDistance(ordered[0], ordered[1]) +
      calculateDistance(ordered[3], ordered[2])) /
    2;
  const h =
    (calculateDistance(ordered[0], ordered[3]) +
      calculateDistance(ordered[1], ordered[2])) /
    2;
  if (w < 1 || h < 1) {
    return {
      isValid: false,
      qualityScore: 0,
      isPoorQuality: true,
      perspectiveWarning: null,
    };
  }

  const aspectDiff = Math.abs(h / w - TARGET_ASPECT_RATIO);
  const topSide = calculateDistance(ordered[0], ordered[1]);
  const bottomSide = calculateDistance(ordered[3], ordered[2]);
  const leftSide = calculateDistance(ordered[0], ordered[3]);
  const rightSide = calculateDistance(ordered[1], ordered[2]);
  const hRatio =
    Math.max(topSide, bottomSide) / Math.min(topSide, bottomSide);
  const vRatio =
    Math.max(leftSide, rightSide) / Math.min(leftSide, rightSide);

  let qualityScore =
    100 -
    Math.min(aspectDiff * 40, 40) -
    Math.min((hRatio - 1) * 15, 20) -
    Math.min((vRatio - 1) * 15, 20);
  qualityScore = Math.max(qualityScore, 0);

  const isPoorQuality =
    aspectDiff > 1.2 && (hRatio > 3.5 || vRatio > 3.5);

  let perspectiveWarning: string | null = null;
  if (bottomSide / topSide > 1.35 || vRatio > 1.35) {
    perspectiveWarning = 'Align your camera with the document!';
  }

  const needsCorrection =
    aspectDiff > MAX_ASPECT_RATIO_DIFF ||
    hRatio > MAX_SIDE_RATIO ||
    vRatio > MAX_SIDE_RATIO;
  return {
    isValid: true,
    correctedCorners: needsCorrection
      ? correctToRectangle(ordered)
      : undefined,
    qualityScore,
    isPoorQuality,
    perspectiveWarning,
  };
};

const getCalibrationInfo = (brightness: number) => {
  'worklet';
  brightnessCalibration.minSeen = Math.min(
    brightnessCalibration.minSeen,
    brightness,
  );
  brightnessCalibration.maxSeen = Math.max(
    brightnessCalibration.maxSeen,
    brightness,
  );
  brightnessCalibration.frameCount++;
  brightnessCalibration.history.push(brightness);
  if (brightnessCalibration.history.length > 50)
    brightnessCalibration.history.shift();

  const avg =
    brightnessCalibration.history.length > 0
      ? brightnessCalibration.history.reduce((s, v) => s + v, 0) /
        brightnessCalibration.history.length
      : brightness;
  const range = brightnessCalibration.maxSeen - brightnessCalibration.minSeen;

  let darkThreshold: number, brightThreshold: number;
  if (brightnessCalibration.frameCount < 5) {
    const defaults =
      brightness < 30
        ? {dark: 15, bright: 120}
        : brightness > 50
        ? {dark: 60, bright: 150}
        : {dark: 40, bright: 140};
    darkThreshold = defaults.dark;
    brightThreshold = defaults.bright;
  } else if (range < 30) {
    const offset = avg < 50 ? 35 : 25;
    darkThreshold = Math.max(brightnessCalibration.minSeen, avg - offset);
    brightThreshold = Math.min(brightnessCalibration.maxSeen, avg + offset);
  } else {
    darkThreshold = brightnessCalibration.minSeen + range * 0.2;
    brightThreshold = brightnessCalibration.minSeen + range * 0.8;
  }

  return {
    darkThreshold,
    brightThreshold,
    frameCount: brightnessCalibration.frameCount,
    range,
    average: avg,
  };
};

// === MAIN HOOK ===

export const useInferenceLogic = (
  onInference: (detections: DetectionResult[]) => void,
  screenWidth: number,
  screenHeight: number,
  isProcessingEnabled: boolean = true,
) => {
  const onInferenceJS = Worklets.createRunOnJS(onInference);
  const {resize} = useResizePlugin();
  const {scanBarcodes} = useBarcodeScanner(['qr']);
  const isProcessingEnabledShared = useSharedValue(isProcessingEnabled);

  useEffect(() => {
    isProcessingEnabledShared.value = isProcessingEnabled;
  }, [isProcessingEnabled, isProcessingEnabledShared]);

  useEffect(() => {
    return () => {
      brightnessCalibration = {
        minSeen: 255,
        maxSeen: 0,
        frameCount: 0,
        history: [],
      };
    };
  }, []);

  // Persistent state across frames
  const seeker = {
    isActive: true,
    direction: 'up' as 'up' | 'down',
    offset: 0,
    step: SEEKER_STEP,
    noDocCounter: 0,
    frameCounter: 0,
    debugFrameCounter: 0,
    consecutiveDetections: 0,
    consecutiveNoDetections: 0,
    isStableDetection: false,
    frameSkipCounter: 0,
    previousCorners: null as DocumentCorner[] | null,
  };

  // Kernel cache
  let cachedBlurKsize: any = null;
  const getBlurKsize = () => {
    'worklet';
    if (!cachedBlurKsize) {
      cachedBlurKsize = OpenCV.createObject(
        ObjectType.Size,
        GAUSSIAN_BLUR_KERNEL_SIZE,
        GAUSSIAN_BLUR_KERNEL_SIZE,
      );
    }
    return cachedBlurKsize;
  };

  // Brightness offset → alpha/beta conversion
  const offsetToAlphaBeta = (
    offset: number,
  ): {alpha: number; beta: number} => {
    'worklet';
    if (offset > 0) {
      const f = offset / SEEKER_MAX_POSITIVE;
      return {alpha: 1.0 + f * 1.2, beta: offset * 1.5};
    }
    if (offset < 0) {
      const f = Math.abs(offset) / SEEKER_MAX_NEGATIVE;
      return {alpha: 1.0 - f * 0.4, beta: offset};
    }
    return {alpha: 1.0, beta: 0};
  };

  // Advance seeker offset (called when no document found)
  const advanceSeeker = () => {
    'worklet';
    seeker.isActive = true;
    seeker.frameCounter++;

    let step = seeker.step;
    const abs = Math.abs(seeker.offset);
    if (abs >= 80) step = 40;
    else if (abs >= 60) step = 30;

    if (seeker.frameCounter >= BRIGHTNESS_CHANGE_INTERVAL) {
      seeker.frameCounter = 0;
      if (seeker.direction === 'up') {
        seeker.offset += step;
        if (seeker.offset > SEEKER_MAX_POSITIVE) {
          seeker.direction = 'down';
          seeker.offset = SEEKER_MAX_POSITIVE;
        }
      } else {
        seeker.offset -= step;
        if (seeker.offset < -SEEKER_MAX_NEGATIVE) {
          seeker.direction = 'up';
          seeker.offset = -SEEKER_MAX_NEGATIVE;
        }
      }
      seeker.step = step;
    }
  };

  const buildSeekerInfo = (
    alpha: number,
    beta: number,
    qualityScore?: number,
    isHighQuality?: boolean,
  ): string => {
    'worklet';
    let info =
      `A:${alpha.toFixed(2).padStart(4)} B:${beta.toFixed(0).padStart(3)}\n` +
      `S:${seeker.isActive ? 'ON ' : 'OFF'} O:${seeker.offset
        .toString()
        .padStart(4)} D:${
        seeker.direction === 'up' ? 'up  ' : 'down'
      }\n` +
      `ST:${seeker.step.toString().padStart(2)} NC:${seeker.noDocCounter
        .toString()
        .padStart(2)}/${REACTIVATE_AFTER_FRAMES} FROZEN:N`;
    if (qualityScore !== undefined) {
      info += `\nQ:${qualityScore.toFixed(0)} ${isHighQuality ? '✓' : '⚠️'}`;
    }
    return info;
  };

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (!isProcessingEnabledShared.value) return;

      seeker.frameSkipCounter++;
      if (seeker.frameSkipCounter % FRAME_SKIP_INTERVAL !== 0) return;

      try {
        // === QR CODE SCANNING ===
        const qrCodes = scanBarcodes(frame);
        let qrInfo = 'QR:✗ Nincs';
        let qrValue: string | null = null;
        let qrPosition: 'left' | 'right' | null = null;
        let qrBounds: {
          left: number;
          top: number;
          width: number;
          height: number;
        } | null = null;

        if (qrCodes && qrCodes.length > 0) {
          const qr = qrCodes[0];
          qrValue = qr.rawValue || null;
          qrBounds = {
            left: qr.left,
            top: qr.top,
            width: qr.width,
            height: qr.height,
          };
          // QR runs on landscape frame; after 90° CW rotation:
          // landscape bottom → portrait left, landscape top → portrait right
          const centerY = qr.top + qr.height / 2;
          qrPosition = centerY > frame.height / 2 ? 'left' : 'right';
          qrInfo = `QR:✓ ${qrPosition.toUpperCase()} @${Math.round(
            qr.left + qr.width / 2,
          )},${Math.round(centerY)} "${qr.rawValue}"`;
        }

        // === FRAME PREPROCESSING ===
        const maxDim = Math.max(frame.width, frame.height);
        let pw: number, ph: number;
        if (maxDim > MAX_PROCESS_DIMENSION) {
          const sf = MAX_PROCESS_DIMENSION / maxDim;
          pw = Math.round(frame.width * sf);
          ph = Math.round(frame.height * sf);
        } else {
          pw = frame.width;
          ph = frame.height;
        }
        // After 90° CW rotation, width and height swap
        const rotH = pw,
          rotW = ph;

        const resized = resize(frame, {
          dataType: 'uint8',
          pixelFormat: 'bgr',
          scale: {height: ph, width: pw},
        });
        const srcMat = OpenCV.frameBufferToMat(ph, pw, 3, resized);
        OpenCV.invoke('rotate', srcMat, srcMat, 0); // ROTATE_90_CLOCKWISE

        // Grayscale + brightness measurement
        const gray = OpenCV.createObject(
          ObjectType.Mat,
          rotH,
          rotW,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke(
          'cvtColor',
          srcMat,
          gray,
          ColorConversionCodes.COLOR_BGR2GRAY,
        );

        const meanData = OpenCV.toJSValue(OpenCV.invoke('mean', gray));
        const meanBrightness = meanData.a;
        const calibInfo = getCalibrationInfo(meanBrightness);

        // Brightness adjustment from seeker
        const {alpha, beta} = offsetToAlphaBeta(seeker.offset);
        const brightened = OpenCV.createObject(
          ObjectType.Mat,
          rotH,
          rotW,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke('convertScaleAbs', gray, brightened, alpha, beta);

        // === EDGE DETECTION (Canny only) ===
        const cropMarginW = Math.floor(rotW * CROP_MARGIN_RATIO);
        const cropMarginH = Math.floor(rotH * CROP_MARGIN_RATIO);
        const imgArea = rotW * rotH;
        const minArea = imgArea * MIN_AREA_RATIO;
        const maxArea = imgArea * MAX_AREA_RATIO;

        const blurred = OpenCV.createObject(
          ObjectType.Mat,
          rotH,
          rotW,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke('GaussianBlur', brightened, blurred, getBlurKsize(), 0);

        const edges = OpenCV.createObject(
          ObjectType.Mat,
          rotH,
          rotW,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke('Canny', blurred, edges, CANNY_LOW, CANNY_HIGH);

        // Dilate edges to close small gaps (glare, broken edges)
        const dilKsize = OpenCV.createObject(ObjectType.Size, 3, 3);
        const dilKernel = OpenCV.invoke(
          'getStructuringElement',
          MorphShapes.MORPH_RECT,
          dilKsize,
        );
        OpenCV.invoke(
          'morphologyEx',
          edges,
          edges,
          MorphTypes.MORPH_DILATE,
          dilKernel,
        );

        // === FIND & SCORE CONTOURS ===
        const contours = OpenCV.createObject(ObjectType.MatVector);
        OpenCV.invoke(
          'findContours',
          edges,
          contours,
          RetrievalModes.RETR_EXTERNAL,
          ContourApproximationModes.CHAIN_APPROX_SIMPLE,
        );
        const contoursData = OpenCV.toJSValue(contours);
        const contoursSize = contoursData.array.length;

        let documentContour: any = null;
        let maxValidArea = 0;
        let bestScore = 0;

        for (let i = 0; i < contoursSize; i++) {
          const contour = OpenCV.copyObjectFromVector(contours, i);
          const area = OpenCV.invoke('contourArea', contour).value;
          if (area <= minArea || area >= maxArea) continue;

          const rectData = OpenCV.toJSValue(
            OpenCV.invoke('boundingRect', contour),
          );

          // Skip contours touching frame edges
          if (
            rectData.x <= cropMarginW ||
            rectData.y <= cropMarginH ||
            rectData.x + rectData.width >= rotW - cropMarginW ||
            rectData.y + rectData.height >= rotH - cropMarginH
          )
            continue;

          const aspectRatio = rectData.width / rectData.height;
          // Must be portrait (< 0.9) or landscape (> 1.1), not square
          if (!(aspectRatio < MIN_PORTRAIT_ASPECT_RATIO || aspectRatio > 1.1))
            continue;

          const perimeter = OpenCV.invoke('arcLength', contour, true).value;
          const solidity = area / (rectData.width * rectData.height);

          for (const epsMult of EPSILON_VALUES) {
            const approx = OpenCV.createObject(ObjectType.PointVector);
            OpenCV.invoke(
              'approxPolyDP',
              contour,
              approx,
              epsMult * perimeter,
              true,
            );
            const approxData = OpenCV.toJSValue(approx);
            if (approxData.array.length !== 4) continue;

            let score = (area / imgArea) * 100;
            if (aspectRatio > 0.2 && aspectRatio < 8.0)
              score += SCORE_ASPECT_GOOD;
            else if (aspectRatio > 0.1 && aspectRatio < 15.0)
              score += SCORE_ASPECT_OK;
            if (solidity > 0.3) score += SCORE_SOLIDITY_HIGH;
            else if (solidity > 0.2) score += SCORE_SOLIDITY_MEDIUM;
            else if (solidity > 0.1) score += SCORE_SOLIDITY_LOW;
            const minDim = Math.min(rectData.width, rectData.height);
            if (minDim > rotW * 0.08 && minDim > rotH * 0.08)
              score += SCORE_SIZE_LARGE;
            else if (minDim > rotW * 0.04 && minDim > rotH * 0.04)
              score += SCORE_SIZE_MEDIUM;

            if (score > bestScore) {
              documentContour = approx;
              maxValidArea = area;
              bestScore = score;
            }
            break; // Found 4-corner approx, skip remaining epsilons
          }
        }

        let documentFoundInThisFrame = false;

        // === PROCESS FOUND CONTOUR ===
        if (documentContour) {
          const contourData = OpenCV.toJSValue(documentContour) as any;
          const processingCorners: DocumentCorner[] = contourData.array.map(
            (point: any) => ({x: point.x, y: point.y}),
          );

          if (processingCorners.length === 4) {
            const validation = validatePerspective(processingCorners);

            if (validation.isValid) {
              const finalPC =
                validation.correctedCorners || processingCorners;
              const orderedPC = orderCorners(finalPC);
              const isHighQuality =
                !validation.isPoorQuality && validation.qualityScore >= 40;

              // Corner stability check
              const cornersStable = areCornersStable(
                orderedPC,
                seeker.previousCorners,
                30,
              );
              if (!cornersStable) {
                seeker.consecutiveDetections = 0;
                seeker.isStableDetection = false;
              }
              seeker.previousCorners = orderedPC.map(c => ({
                x: c.x,
                y: c.y,
              }));
              documentFoundInThisFrame = isHighQuality && cornersStable;

              // Anti-flicker counting
              seeker.consecutiveDetections++;
              seeker.consecutiveNoDetections = 0;
              if (
                seeker.consecutiveDetections >= STABLE_DETECTION_THRESHOLD &&
                isHighQuality &&
                cornersStable
              ) {
                seeker.isStableDetection = true;
              }
              if (!isHighQuality && seeker.isStableDetection) {
                seeker.isStableDetection = false;
                seeker.consecutiveDetections = 0;
              }

              seeker.noDocCounter = 0;

              // Only send result when detection is stable
              if (seeker.isStableDetection) {
                // Screen coordinate transform (account for resizeMode="cover" crop)
                const rotAspect = rotW / rotH;
                const scrAspect = screenWidth / screenHeight;
                let cropOX = 0,
                  cropOY = 0,
                  visW = rotW,
                  visH = rotH;
                if (rotAspect > scrAspect) {
                  visW = rotH * scrAspect;
                  cropOX = (rotW - visW) / 2;
                } else {
                  visH = rotW / scrAspect;
                  cropOY = (rotH - visH) / 2;
                }
                const sX = screenWidth / visW,
                  sY = screenHeight / visH;
                const screenCorners = orderedPC.map(p => ({
                  x: Math.round((p.x - cropOX) * sX),
                  y: Math.round((p.y - cropOY) * sY),
                }));

                // Full-res upscale for scan pipeline
                const uX = frame.height / rotW,
                  uY = frame.width / rotH;
                const fullResPC = orderedPC.map(p => ({
                  x: Math.round(p.x * uX),
                  y: Math.round(p.y * uY),
                }));

                // Debug image
                let debugBase64 = '';
                if (DEBUG_ON) {
                  seeker.debugFrameCounter++;
                  if (seeker.debugFrameCounter >= 1) {
                    seeker.debugFrameCounter = 0;
                    const dbg = OpenCV.createObject(
                      ObjectType.Mat,
                      rotH,
                      rotW,
                      DataTypes.CV_8UC3,
                    );
                    OpenCV.invoke(
                      'cvtColor',
                      edges,
                      dbg,
                      ColorConversionCodes.COLOR_GRAY2RGB,
                    );
                    const colors = [
                      OpenCV.createObject(ObjectType.Scalar, 255, 0, 0),
                      OpenCV.createObject(ObjectType.Scalar, 0, 255, 0),
                      OpenCV.createObject(ObjectType.Scalar, 0, 0, 255),
                      OpenCV.createObject(ObjectType.Scalar, 255, 255, 0),
                    ];
                    for (let ci = 0; ci < 4; ci++) {
                      const pt = OpenCV.createObject(
                        ObjectType.Point,
                        Math.round(orderedPC[ci].x),
                        Math.round(orderedPC[ci].y),
                      );
                      OpenCV.invoke('circle', dbg, pt, 24, colors[ci], -1, 8);
                      const pt2 = OpenCV.createObject(
                        ObjectType.Point,
                        Math.round(orderedPC[(ci + 1) % 4].x),
                        Math.round(orderedPC[(ci + 1) % 4].y),
                      );
                      const blue = OpenCV.createObject(
                        ObjectType.Scalar,
                        0,
                        0,
                        255,
                      );
                      OpenCV.invoke('line', dbg, pt, pt2, blue, 6, 8);
                    }
                    debugBase64 = OpenCV.toJSValue(dbg).base64;
                  }
                }

                onInferenceJS([
                  {
                    corners: screenCorners,
                    processedCorners: fullResPC,
                    confidence: Math.min(
                      maxValidArea / (imgArea * 0.2),
                      1.0,
                    ),
                    debugImage: debugBase64,
                    brightness: meanBrightness,
                    seekerInfo: buildSeekerInfo(
                      alpha,
                      beta,
                      validation.qualityScore,
                      isHighQuality,
                    ),
                    qrInfo,
                    qrValue,
                    qrPosition,
                    qrBounds,
                    blurInfo: 'Blur:✓ (skip)',
                    perspectiveWarning: validation.perspectiveWarning,
                    frameWidth: frame.width,
                    frameHeight: frame.height,
                    calibrationInfo: calibInfo,
                  },
                ]);
              }
              // If not stable yet, don't send — wait for more frames
            } else {
              // Invalid perspective
              seeker.previousCorners = null;
              onInferenceJS([
                {
                  corners: [],
                  confidence: 0,
                  debugImage: '',
                  brightness: meanBrightness,
                  seekerInfo: buildSeekerInfo(alpha, beta),
                  qrInfo,
                  qrValue,
                  qrPosition,
                  qrBounds,
                  blurInfo: 'Blur:✓ (skip)',
                  calibrationInfo: calibInfo,
                },
              ]);
            }
          } else {
            // Not 4 corners
            seeker.noDocCounter = 0;
            seeker.previousCorners = null;
            onInferenceJS([
              {
                corners: [],
                confidence: 0,
                debugImage: '',
                brightness: meanBrightness,
                seekerInfo: buildSeekerInfo(alpha, beta),
                qrInfo,
                qrValue,
                qrPosition,
                qrBounds,
                blurInfo: 'Blur:✓ (skip)',
                calibrationInfo: calibInfo,
              },
            ]);
          }
        } else {
          // No contour found
          seeker.previousCorners = null;
          onInferenceJS([
            {
              corners: [],
              confidence: 0,
              debugImage: '',
              brightness: meanBrightness,
              seekerInfo: buildSeekerInfo(alpha, beta),
              qrInfo,
              qrValue,
              qrPosition,
              qrBounds,
              blurInfo: 'Blur:✓ (skip)',
              calibrationInfo: calibInfo,
            },
          ]);
        }

        // === POST-FRAME: anti-flicker + seeker advancement ===
        if (!documentFoundInThisFrame) {
          seeker.consecutiveDetections = 0;
          seeker.consecutiveNoDetections++;
          if (
            seeker.consecutiveNoDetections >= STABLE_NO_DETECTION_THRESHOLD
          ) {
            seeker.isStableDetection = false;
          }
          advanceSeeker();
        }

        OpenCV.clearBuffers();
      } catch (error) {
        onInferenceJS([
          {
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
          },
        ]);
        OpenCV.clearBuffers();
      }
    },
    [screenWidth, screenHeight],
  );

  return {frameProcessor};
};
