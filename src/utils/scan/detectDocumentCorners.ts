import {
  OpenCV,
  ObjectType,
  ColorConversionCodes,
  RetrievalModes,
  ContourApproximationModes,
  MorphShapes,
  AdaptiveThresholdTypes,
  ThresholdTypes,
  DataTypes,
} from 'react-native-fast-opencv';
import {SCAN_CONFIG, CORNER_DETECTION_CONFIG} from './scanConfig';

// === CONFIGURATION (from scanConfig.ts) ===
const {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  MIN_AREA_RATIO,
  MAX_AREA_RATIO,
  MIN_DOCUMENT_AREA_RATIO,
  ADAPTIVE_BLOCK_SIZE,
  ADAPTIVE_C,
  CANNY_LOW,
  CANNY_HIGH,
  BLUR_KERNEL,
  MORPH_KERNEL,
  EPSILON_VALUES,
} = CORNER_DETECTION_CONFIG;
const { TARGET_ASPECT_RATIO, MAX_ASPECT_RATIO_DIFF, MAX_SIDE_RATIO } = SCAN_CONFIG;

interface DocumentCorner { x: number; y: number }

interface DetectionParams {
  mat: any;
  width: number;
  height: number;
  alpha: number;
  beta: number;
  enableDebugImages?: boolean;
}

interface DetectionResult {
  corners: DocumentCorner[] | null;
  confidence: number;
  debugInfo?: string;
  debugImage?: string;
  debugGray?: string;
  debugBrightened?: string;
  debugAdaptive?: string;
  debugBinary?: string;
  debugBlurred?: string;
  debugMorph?: string;
  debugCanny?: string;
  debugCombined?: string;
  debugContours?: string;
}

// === GEOMETRY HELPERS ===

const dist = (a: DocumentCorner, b: DocumentCorner) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const orderCorners = (corners: DocumentCorner[]): DocumentCorner[] => {
  const withMeta = corners.map(c => ({ ...c, sum: c.x + c.y, diff: c.x - c.y }));
  const tl = withMeta.reduce((a, b) => b.sum < a.sum ? b : a);
  const br = withMeta.reduce((a, b) => b.sum > a.sum ? b : a);
  const tr = withMeta.reduce((a, b) => b.diff < a.diff ? b : a);
  const bl = withMeta.reduce((a, b) => b.diff > a.diff ? b : a);
  return [
    { x: tl.x, y: tl.y },
    { x: tr.x, y: tr.y },
    { x: br.x, y: br.y },
    { x: bl.x, y: bl.y },
  ];
};

const correctToRectangle = (corners: DocumentCorner[]): DocumentCorner[] => {
  const [tl, tr, br, bl] = corners;
  const cx = (tl.x + tr.x + br.x + bl.x) * 0.25;
  const cy = (tl.y + tr.y + br.y + bl.y) * 0.25;
  const avgW = (dist(tl, tr) + dist(bl, br)) * 0.5;
  const avgH = (dist(tl, bl) + dist(tr, br)) * 0.5;

  let w, h;
  if (avgH / avgW > TARGET_ASPECT_RATIO) {
    h = avgH; w = h / TARGET_ASPECT_RATIO;
  } else {
    w = avgW; h = w * TARGET_ASPECT_RATIO;
  }

  const hw = w * 0.5, hh = h * 0.5;
  return [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ];
};

const validateAndCorrect = (corners: DocumentCorner[]): {
  isValid: boolean;
  corrected?: DocumentCorner[];
  score: number;
} => {
  if (corners.length !== 4) return { isValid: false, score: 0 };

  const ordered = orderCorners(corners);
  const w = (dist(ordered[0], ordered[1]) + dist(ordered[3], ordered[2])) / 2;
  const h = (dist(ordered[0], ordered[3]) + dist(ordered[1], ordered[2])) / 2;
  if (w < 1 || h < 1) return { isValid: false, score: 0 };

  const aspectDiff = Math.abs(h / w - TARGET_ASPECT_RATIO);
  const topSide = dist(ordered[0], ordered[1]);
  const bottomSide = dist(ordered[3], ordered[2]);
  const leftSide = dist(ordered[0], ordered[3]);
  const rightSide = dist(ordered[1], ordered[2]);
  const hRatio = Math.max(topSide, bottomSide) / Math.min(topSide, bottomSide);
  const vRatio = Math.max(leftSide, rightSide) / Math.min(leftSide, rightSide);

  let score = 100 - Math.min(aspectDiff * 40, 40)
    - Math.min((hRatio - 1) * 15, 20)
    - Math.min((vRatio - 1) * 15, 20);
  score = Math.max(score, 0);

  const needsCorrection = aspectDiff > MAX_ASPECT_RATIO_DIFF
    || hRatio > MAX_SIDE_RATIO || vRatio > MAX_SIDE_RATIO;

  return {
    isValid: true,
    corrected: needsCorrection ? correctToRectangle(ordered) : undefined,
    score,
  };
};

// === DEBUG HELPER ===

const matToDebugBase64 = (mat: any, w: number, h: number, isGray: boolean): string | undefined => {
  try {
    if (isGray) {
      const rgb = OpenCV.createObject(ObjectType.Mat, h, w, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', mat, rgb, ColorConversionCodes.COLOR_GRAY2BGR);
      const result = OpenCV.toJSValue(rgb);
      return result?.base64 || undefined;
    }
    const rgb = OpenCV.createObject(ObjectType.Mat, h, w, DataTypes.CV_8UC3);
    OpenCV.invoke('cvtColor', mat, rgb, ColorConversionCodes.COLOR_BGR2RGB);
    const result = OpenCV.toJSValue(rgb);
    return result?.base64 || undefined;
  } catch { return undefined; }
};

// === MAIN DETECTION ===

export const detectDocumentCorners = (params: DetectionParams): DetectionResult => {
  const { mat, width: photoWidth, height: photoHeight, alpha, beta, enableDebugImages = false } = params;

  try {
    // 1. Downscale to frame resolution
    const downscaled = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
    const dsize = OpenCV.createObject(ObjectType.Size, FRAME_WIDTH, FRAME_HEIGHT);
    OpenCV.invoke('resize', mat, downscaled, dsize, 0, 0, 3); // INTER_AREA

    const debugImages: Partial<DetectionResult> = {};
    if (enableDebugImages) {
      debugImages.debugImage = matToDebugBase64(downscaled, FRAME_WIDTH, FRAME_HEIGHT, false);
    }

    // 2. Grayscale + brightness
    const gray = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC1);
    OpenCV.invoke('cvtColor', downscaled, gray, ColorConversionCodes.COLOR_BGR2GRAY);

    const brightened = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC1);
    OpenCV.invoke('convertScaleAbs', gray, brightened, alpha, beta);

    // Median blur — reduces glare spots (salt-and-pepper-like) while preserving edges
    const deglared = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC1);
    OpenCV.invoke('medianBlur', brightened, deglared, 5);

    if (enableDebugImages) {
      debugImages.debugGray = matToDebugBase64(gray, FRAME_WIDTH, FRAME_HEIGHT, true);
      debugImages.debugBrightened = matToDebugBase64(brightened, FRAME_WIDTH, FRAME_HEIGHT, true);
    }

    const imgArea = FRAME_WIDTH * FRAME_HEIGHT;
    const minArea = imgArea * MIN_AREA_RATIO;
    const maxArea = imgArea * MAX_AREA_RATIO;
    const absMinArea = imgArea * MIN_DOCUMENT_AREA_RATIO;

    // 3. Adaptive threshold (computed for debug, but not used for contours)
    const adaptive = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC1);
    OpenCV.invoke('adaptiveThreshold', brightened, adaptive, 255,
      AdaptiveThresholdTypes.ADAPTIVE_THRESH_MEAN_C, ThresholdTypes.THRESH_BINARY,
      ADAPTIVE_BLOCK_SIZE, ADAPTIVE_C);

    if (enableDebugImages) {
      debugImages.debugAdaptive = matToDebugBase64(adaptive, FRAME_WIDTH, FRAME_HEIGHT, true);
    }

    // 4. Binary threshold + morphology closing (computed for debug only)
    const binary = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', brightened, binary, 100, 255, ThresholdTypes.THRESH_BINARY);

    const morphKsize = OpenCV.createObject(ObjectType.Size, MORPH_KERNEL, MORPH_KERNEL);
    const morphKernel = OpenCV.invoke('getStructuringElement', MorphShapes.MORPH_RECT, morphKsize);
    OpenCV.invoke('morphologyEx', binary, binary, 3, morphKernel); // MORPH_CLOSE = 3

    if (enableDebugImages) {
      debugImages.debugBinary = matToDebugBase64(binary, FRAME_WIDTH, FRAME_HEIGHT, true);
      debugImages.debugMorph = matToDebugBase64(binary, FRAME_WIDTH, FRAME_HEIGHT, true);
    }

    // 5. Gaussian blur on deglared image + Canny (THIS is what's used for contours)
    const blurred = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC1);
    const ksize = OpenCV.createObject(ObjectType.Size, BLUR_KERNEL, BLUR_KERNEL);
    OpenCV.invoke('GaussianBlur', deglared, blurred, ksize, 0);

    const edges = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC1);
    OpenCV.invoke('Canny', blurred, edges, CANNY_LOW, CANNY_HIGH);

    // Dilate edges to close small gaps caused by glare breaking edge continuity
    const dilateKsize = OpenCV.createObject(ObjectType.Size, 3, 3);
    const dilateKernel = OpenCV.invoke('getStructuringElement', MorphShapes.MORPH_RECT, dilateKsize);
    OpenCV.invoke('morphologyEx', edges, edges, 1, dilateKernel); // MORPH_DILATE = 1

    if (enableDebugImages) {
      debugImages.debugBlurred = matToDebugBase64(blurred, FRAME_WIDTH, FRAME_HEIGHT, true);
      debugImages.debugCanny = matToDebugBase64(edges, FRAME_WIDTH, FRAME_HEIGHT, true);
      debugImages.debugCombined = matToDebugBase64(edges, FRAME_WIDTH, FRAME_HEIGHT, true);
    }

    // 6. Find contours on Canny edges
    const contours = OpenCV.createObject(ObjectType.MatVector);
    OpenCV.invoke('findContours', edges, contours, RetrievalModes.RETR_EXTERNAL, ContourApproximationModes.CHAIN_APPROX_SIMPLE);

    const contoursData = OpenCV.toJSValue(contours);
    const contoursSize = contoursData.array.length;

    if (enableDebugImages) {
      try {
        const contoursMat = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
        OpenCV.invoke('cvtColor', downscaled, contoursMat, ColorConversionCodes.COLOR_BGR2RGB);
        const green = OpenCV.createObject(ObjectType.Scalar, 0, 255, 0, 255);
        OpenCV.invoke('drawContours', contoursMat, contours, -1, green, 2, 8);
        const r = OpenCV.toJSValue(contoursMat);
        debugImages.debugContours = r?.base64 || undefined;
      } catch {}
    }

    // 7. Score contours — find best 4-corner document
    let bestApprox: any = null;
    let bestArea = 0;
    let bestScore = 0;

    for (let i = 0; i < contoursSize; i++) {
      const contour = OpenCV.copyObjectFromVector(contours, i);
      const areaResult = OpenCV.invoke('contourArea', contour);

      let area: number;
      if (typeof areaResult === 'number') {
        area = areaResult;
      } else if (areaResult && typeof areaResult === 'object') {
        area = (areaResult as any).value ?? (areaResult as any).area ?? 0;
        if (area < 100) {
          try {
            const jsVal = OpenCV.toJSValue(areaResult as any);
            area = typeof jsVal === 'number' ? jsVal : ((jsVal as any)?.value ?? 0);
          } catch {}
        }
      } else {
        area = 0;
      }

      if (area < absMinArea || area <= minArea || area >= maxArea) continue;

      const boundingRect = OpenCV.invoke('boundingRect', contour);
      const rd = OpenCV.toJSValue(boundingRect);
      const ar = rd.width / rd.height;

      // Accept portrait (0.4–0.95) or landscape (1.05–2.5), reject squares
      if (!((ar >= 0.4 && ar <= 0.95) || (ar >= 1.05 && ar <= 2.5))) continue;

      const perimeterResult = OpenCV.invoke('arcLength', contour, true);
      const perimeter = perimeterResult.value;
      const boundingArea = rd.width * rd.height;
      const solidity = area / boundingArea;

      // Try epsilon values to find 4-corner approximation
      for (const epsMult of EPSILON_VALUES) {
        const approx = OpenCV.createObject(ObjectType.PointVector);
        OpenCV.invoke('approxPolyDP', contour, approx, epsMult * perimeter, true);
        const approxData = OpenCV.toJSValue(approx);

        if (approxData.array.length !== 4) continue;

        // Score: area ratio + aspect + solidity + size bonuses
        let score = (area / imgArea) * 100;
        if (ar > 0.2 && ar < 8.0) score += 30;
        else if (ar > 0.1 && ar < 15.0) score += 15;
        if (solidity > 0.3) score += 25;
        else if (solidity > 0.2) score += 15;
        else if (solidity > 0.1) score += 5;
        const minDim = Math.min(rd.width, rd.height);
        if (minDim > FRAME_WIDTH * 0.08 && minDim > FRAME_HEIGHT * 0.08) score += 20;
        else if (minDim > FRAME_WIDTH * 0.04 && minDim > FRAME_HEIGHT * 0.04) score += 10;

        if (score > bestScore) {
          bestApprox = approx;
          bestArea = area;
          bestScore = score;
        }
        break; // Found 4 corners for this contour, stop trying epsilons
      }
    }

    // 8. Process best contour — validate, correct, upscale
    if (bestApprox) {
      const approxData = OpenCV.toJSValue(bestApprox) as any;
      const frameCorners: DocumentCorner[] = approxData.array.map((p: any) => ({ x: p.x, y: p.y }));

      const validation = validateAndCorrect(frameCorners);
      if (validation.isValid) {
        const finalCorners = orderCorners(validation.corrected || frameCorners);

        // Upscale from frame resolution to photo resolution
        const scaleX = photoWidth / FRAME_WIDTH;
        const scaleY = photoHeight / FRAME_HEIGHT;
        const photoCorners = finalCorners.map(p => ({
          x: Math.round(p.x * scaleX),
          y: Math.round(p.y * scaleY),
        }));

        const confidence = Math.min(bestArea / (imgArea * 0.2), 1.0);
        console.log(`✅ Document detected (score:${bestScore.toFixed(0)}, scale:${scaleX.toFixed(2)}x${scaleY.toFixed(2)})`);

        return {
          corners: photoCorners,
          confidence,
          debugInfo: `Quality: ${validation.score.toFixed(0)}`,
          ...debugImages,
        };
      }
    }

    console.log(`❌ No document found in ${contoursSize} contours`);
    return { corners: null, confidence: 0, debugInfo: 'No valid document found', ...debugImages };
  } catch (error) {
    console.error('detectDocumentCorners error:', error);
    return { corners: null, confidence: 0, debugInfo: `Error: ${error}` };
  }
};
