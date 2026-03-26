import { OpenCV, ObjectType, DataTypes, ColorConversionCodes, RetrievalModes, ContourApproximationModes } from 'react-native-fast-opencv';
import { detectDocumentCorners } from './detectDocumentCorners';
import { SCAN_DOCUMENT_CONFIG } from './scanConfig';

const {
  TARGET_OUTPUT_WIDTH,
  TARGET_OUTPUT_HEIGHT,
  BRIGHTNESS_SETTINGS,
  COLOR_MASK,
  DARK_INK,
  BRIGHTNESS,
  ICONS,
  QR,
  CROP,
} = SCAN_DOCUMENT_CONFIG;

interface DocumentCorner {
  x: number;
  y: number;
}

interface ScanDocumentParams {
  rawImageBase64: string;
  frameCorners: DocumentCorner[];
  processedCorners: DocumentCorner[];
  currentQrValue?: string | null;
  currentQrPosition?: 'left' | 'right' | null;
  qrBounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  photoWidth?: number;
  photoHeight?: number;
  frameWidth?: number;
  frameHeight?: number;
  frameBrightness?: number;
  enableDebugImages?: boolean;
}

interface ScanDocumentResult {
  success: boolean;
  imageBase64?: string;
  stepImages?: { label: string; image: string }[];
  error?: string;
  qrValue?: string | null;
  qrPosition?: 'left' | 'right' | null;
  brightnessInfo?: {
    avgBrightness: number;
    lightCondition: 'Daylight' | 'Normal' | 'Night';
    betaBoost: number;
  };
  selectedIcons?: number[];
  selectedIconNames?: string[];
  iconAnalysis?: {
    slot: number;
    icon: string;
    active: boolean;
    darkPercent: number;
  }[];
  debugCorners?: {
    index: number;
    x: number;
    y: number;
  }[];
}

const createMat = (h: number, w: number, type: number) =>
  OpenCV.createObject(ObjectType.Mat, h, w, type);

const createSize = (w: number, h: number) =>
  OpenCV.createObject(ObjectType.Size, w, h);

const createPoint2f = (x: number, y: number) =>
  OpenCV.createObject(ObjectType.Point2f, x, y);

export const scanDocument = (
  params: ScanDocumentParams,
): ScanDocumentResult => {
  const {
    rawImageBase64,
    frameCorners,
    processedCorners,
    currentQrValue,
    currentQrPosition,
    photoWidth: providedWidth,
    photoHeight: providedHeight,
    enableDebugImages = false,
  } = params;

  try {
    if (frameCorners.length !== 4 || processedCorners.length !== 4) {
      return { success: false, error: 'Exactly 4 corners required for both detections' };
    }

    const srcMat = OpenCV.base64ToMat(rawImageBase64);
    const stepImages: { label: string; image: string }[] = [];

    // === 1. ORIENTATION — ensure portrait ===
    let rotatedSrcMat: any;
    let photoWidth: number;
    let photoHeight: number;

    const originalWidth = providedWidth ?? 0;
    const originalHeight = providedHeight ?? 0;

    if (originalWidth > originalHeight) {
      console.log(`🔄 Landscape ${originalWidth}x${originalHeight} → rotating to portrait`);
      const tempRotatedMat = createMat(originalWidth, originalHeight, DataTypes.CV_8UC3);
      OpenCV.invoke('rotate', srcMat, tempRotatedMat, 0); // ROTATE_90_CLOCKWISE
      rotatedSrcMat = OpenCV.invoke('clone', tempRotatedMat);
      photoWidth = originalHeight;
      photoHeight = originalWidth;
    } else {
      rotatedSrcMat = srcMat;
      photoWidth = originalWidth;
      photoHeight = originalHeight;
    }

    // Fallback dimension detection
    if (photoWidth === 0 || photoHeight === 0) {
      try {
        const sizeResult = (srcMat as any).size?.() ?? null;
        if (sizeResult?.width && sizeResult?.height) {
          photoWidth = sizeResult.width;
          photoHeight = sizeResult.height;
        }
      } catch (_) {}
      if (photoWidth === 0 || photoHeight === 0) {
        photoWidth = (srcMat as any).cols ?? (srcMat as any).width ?? 3264;
        photoHeight = (srcMat as any).rows ?? (srcMat as any).height ?? 2448;
        console.warn('⚠️ Using fallback dimensions:', photoWidth, 'x', photoHeight);
      }
    }

    console.log('📸 Photo:', photoWidth, 'x', photoHeight);

    // === 2. CORNER DETECTION — re-detect on full photo ===

    // Try multiple brightness settings for detection
    let photoDetectionResult: any = null;

    for (const settings of BRIGHTNESS_SETTINGS) {
      const result = detectDocumentCorners({
        mat: rotatedSrcMat,
        width: photoWidth,
        height: photoHeight,
        alpha: settings.alpha,
        beta: settings.beta,
        enableDebugImages,
      } as any);

      if (result.corners?.length === 4) {
        console.log(`✅ Detection succeeded with ${settings.name}`);
        photoDetectionResult = result;
        break;
      }
    }

    if (!photoDetectionResult) {
      photoDetectionResult = detectDocumentCorners({
        mat: rotatedSrcMat,
        width: photoWidth,
        height: photoHeight,
        alpha: 1.0,
        beta: 10,
        enableDebugImages,
      } as any);
    }

    // Debug images from corner detection
    if (enableDebugImages) {
      if (photoDetectionResult.debugImage) stepImages.push({ label: '0.2. Downscaled detection input', image: photoDetectionResult.debugImage });
      if (photoDetectionResult.debugGray) stepImages.push({ label: '0.3. Grayscale', image: photoDetectionResult.debugGray });
      if (photoDetectionResult.debugBrightened) stepImages.push({ label: '0.4. Brightness adjusted', image: photoDetectionResult.debugBrightened });
      if (photoDetectionResult.debugAdaptive) stepImages.push({ label: '0.5. Adaptive threshold', image: photoDetectionResult.debugAdaptive });
      if (photoDetectionResult.debugBinary) stepImages.push({ label: '0.6. Binary threshold', image: photoDetectionResult.debugBinary });
      if (photoDetectionResult.debugBlurred) stepImages.push({ label: '0.7. Gaussian blur', image: photoDetectionResult.debugBlurred });
      if (photoDetectionResult.debugMorph) stepImages.push({ label: '0.8. Morphology (closing)', image: photoDetectionResult.debugMorph });
      if (photoDetectionResult.debugCanny) stepImages.push({ label: '0.9. Canny edges', image: photoDetectionResult.debugCanny });
      if (photoDetectionResult.debugCombined) stepImages.push({ label: '0.10. Combined edges', image: photoDetectionResult.debugCombined });
      if (photoDetectionResult.debugContours) stepImages.push({ label: '0.11. All contours', image: photoDetectionResult.debugContours });

      // Draw detected corners on photo
      try {
        const debugMat = OpenCV.createObject(ObjectType.Mat, photoHeight, photoWidth, DataTypes.CV_8UC3);
        OpenCV.invoke('cvtColor', rotatedSrcMat, debugMat, ColorConversionCodes.COLOR_BGR2RGB);
        if (photoDetectionResult.corners?.length === 4) {
          const cs = photoDetectionResult.corners;
          for (let i = 0; i < 4; i++) {
            const p1 = OpenCV.createObject(ObjectType.Point, Math.round(cs[i].x), Math.round(cs[i].y));
            const p2 = OpenCV.createObject(ObjectType.Point, Math.round(cs[(i + 1) % 4].x), Math.round(cs[(i + 1) % 4].y));
            const green = OpenCV.createObject(ObjectType.Scalar, 0, 255, 0, 255);
            OpenCV.invoke('line', debugMat, p1, p2, green, 15, 8);
          }
          for (const c of cs) {
            const pt = OpenCV.createObject(ObjectType.Point, Math.round(c.x), Math.round(c.y));
            const green = OpenCV.createObject(ObjectType.Scalar, 0, 255, 0, 255);
            OpenCV.invoke('circle', debugMat, pt, 30, green, -1, 8);
          }
        }
        const debugResult = OpenCV.toJSValue(debugMat);
        if (debugResult?.base64) stepImages.push({ label: '0.12. Photo edges (green)', image: debugResult.base64 });
      } catch (_) {}
    }

    // Select corners
    let corners: DocumentCorner[];
    if (photoDetectionResult.corners?.length === 4) {
      corners = photoDetectionResult.corners;
    } else {
      console.warn('❌ Photo detection failed - ABORTING');
      return { success: false, error: 'Failed to detect document in photo. Please try again!', stepImages: enableDebugImages ? stepImages : [] };
    }

    // === 3. PERSPECTIVE TRANSFORM ===
    const width = TARGET_OUTPUT_WIDTH;
    const height = TARGET_OUTPUT_HEIGHT;

    const srcPoints = OpenCV.createObject(ObjectType.Point2fVector, [
      createPoint2f(corners[0].x, corners[0].y),
      createPoint2f(corners[1].x, corners[1].y),
      createPoint2f(corners[2].x, corners[2].y),
      createPoint2f(corners[3].x, corners[3].y),
    ]);
    const dstPoints = OpenCV.createObject(ObjectType.Point2fVector, [
      createPoint2f(0, 0),
      createPoint2f(width, 0),
      createPoint2f(width, height),
      createPoint2f(0, height),
    ]);

    const M = OpenCV.invoke('getPerspectiveTransform', srcPoints, dstPoints, 0);
    const dstMat = createMat(height, width, DataTypes.CV_8UC3);
    const borderValue = OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0);
    OpenCV.invoke('warpPerspective', rotatedSrcMat, dstMat, M, createSize(width, height), 1, 0, borderValue);

    // Orientation correction: flip horizontal + rotate 90° counterclockwise
    const stableDstMat = OpenCV.invoke('clone', dstMat);
    const flippedMat = createMat(height, width, DataTypes.CV_8UC3);
    OpenCV.invoke('flip', stableDstMat, flippedMat, 1);
    const rotatedMat = createMat(height, width, DataTypes.CV_8UC3);
    OpenCV.invoke('rotate', flippedMat, rotatedMat, 2); // ROTATE_90_COUNTERCLOCKWISE

    // rotate 90° CCW swaps dimensions — resize back to target portrait (width x height)
    const croppedMat = createMat(height, width, DataTypes.CV_8UC3);
    OpenCV.invoke('resize', rotatedMat, croppedMat, createSize(width, height), 0, 0, 2);

    const cropWidth = width;
    const cropHeight = height;

    if (enableDebugImages) {
      const step0Result = OpenCV.toJSValue(rotatedSrcMat);
      if (step0Result?.base64) stepImages.push({ label: '0.13. Original photo', image: step0Result.base64 });
      const step1Result = OpenCV.toJSValue(croppedMat);
      if (step1Result?.base64) stepImages.push({ label: '1. Warped & cropped', image: step1Result.base64 });
    }

    // === 3.1 BRIGHTNESS CHECK (before white balance) ===
    const grayMat = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('cvtColor', croppedMat, grayMat, 6, 0); // COLOR_BGR2GRAY
    const meanResult = OpenCV.invoke('mean', grayMat);
    const meanData = OpenCV.toJSValue(meanResult);
    const avgBrightness = Math.round(meanData.a);

    const lightCondition: 'Daylight' | 'Normal' | 'Night' =
      avgBrightness > BRIGHTNESS.DAYLIGHT_THRESHOLD ? 'Daylight' : avgBrightness > BRIGHTNESS.NORMAL_THRESHOLD ? 'Normal' : 'Night';

    console.log(`💡 Brightness: ${avgBrightness} (${lightCondition})`);

    if (avgBrightness > BRIGHTNESS.OVEREXPOSURE_THRESHOLD) {
      console.warn('⚠️ Overexposed image - requesting retry');
      return {
        success: false,
        error: 'Overexposed photo - retrying',
        imageBase64: '',
        stepImages: [],
        qrValue: currentQrValue,
        qrPosition: currentQrPosition,
        brightnessInfo: { avgBrightness, lightCondition, betaBoost: 0 },
        selectedIcons: [],
        selectedIconNames: [],
        iconAnalysis: [],
      };
    }

    // === 4. COLOR MASK — detect vibrant colored regions ===
    console.log(`🎨 Creating color mask (T1sat=${COLOR_MASK.TIER1_SAT_THRESHOLD} T1min=${COLOR_MASK.TIER1_MIN_CHANNEL_MAX} T2sat=${COLOR_MASK.TIER2_SAT_THRESHOLD} T2min=${COLOR_MASK.NOT_PAPER_MIN_CHANNEL})`);
    const bChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    const gChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    const rChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('extractChannel', croppedMat, bChannel, 0);
    OpenCV.invoke('extractChannel', croppedMat, gChannel, 1);
    OpenCV.invoke('extractChannel', croppedMat, rChannel, 2);

    const maxChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    const minChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('max', bChannel, gChannel, maxChannel);
    OpenCV.invoke('max', maxChannel, rChannel, maxChannel);
    OpenCV.invoke('min', bChannel, gChannel, minChannel);
    OpenCV.invoke('min', minChannel, rChannel, minChannel);

    // Saturation = max - min
    const saturation = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('subtract', maxChannel, minChannel, saturation);

    // Two-tier color detection:
    // Tier 1: High saturation (>80) AND at least one dark channel (minChannel < 100)
    //   → vivid red, pure blue/green — but NOT warm-tinted paper
    // Tier 2: Medium saturation (>50) AND not-paper (minChannel < 130)
    //   → catches lighter greens, blues while excluding yellowish/bluish paper tint

    // Tier 1: vivid colors + not paper tint
    const highSatMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', saturation, highSatMask, COLOR_MASK.TIER1_SAT_THRESHOLD, 255, 0);
    const tier1NotPaperMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', minChannel, tier1NotPaperMask, COLOR_MASK.TIER1_MIN_CHANNEL_MAX, 255, 1);
    const tier1Mask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', highSatMask, tier1NotPaperMask, tier1Mask);

    // Tier 2: medium sat + not-paper (at least one channel must be dark = real ink)
    const medSatMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', saturation, medSatMask, COLOR_MASK.TIER2_SAT_THRESHOLD, 255, 0);
    const notPaperMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', minChannel, notPaperMask, COLOR_MASK.NOT_PAPER_MIN_CHANNEL, 255, 1); // minChannel <= threshold = ink
    const tier2Mask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', medSatMask, notPaperMask, tier2Mask);

    // Combine tiers: vivid OR (medium + not-paper)
    const colorMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_or', tier1Mask, tier2Mask, colorMask);

    // Brightness filters: must be visible and not blown-out white
    const brightMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', maxChannel, brightMask, COLOR_MASK.BRIGHTNESS_FLOOR, 255, 0);
    const notTooWhiteMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', maxChannel, notTooWhiteMask, COLOR_MASK.WHITE_CEILING, 255, 1);

    const colorMaskFiltered = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', colorMask, brightMask, colorMaskFiltered);
    OpenCV.invoke('bitwise_and', colorMaskFiltered, notTooWhiteMask, colorMaskFiltered);

    // Small dilate to cover color edges
    const dilateKernel = OpenCV.invoke('getStructuringElement', 2, createSize(COLOR_MASK.DILATE_KERNEL_SIZE, COLOR_MASK.DILATE_KERNEL_SIZE));
    const colorMaskDilated = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', colorMaskFiltered, colorMaskDilated, 1, dilateKernel);

    if (enableDebugImages) {
      const colorMaskBGR = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', colorMaskDilated, colorMaskBGR, 8, 0);
      const r = OpenCV.toJSValue(colorMaskBGR);
      if (r?.base64) stepImages.push({ label: '2. Color mask', image: r.base64 });
    }

    // === 5. DARK INK MASK — adaptive threshold on maxChannel ===
    console.log('🖊️ Creating dark ink mask');
    const totalPixels = cropWidth * cropHeight;
    const isHighRes = totalPixels > DARK_INK.HIGH_RES_PIXEL_THRESHOLD;
    const darkInkBlockSize = isHighRes ? DARK_INK.BLOCK_SIZE_HIGH_RES : DARK_INK.BLOCK_SIZE_LOW_RES;
    const darkInkC = isHighRes ? DARK_INK.ADAPTIVE_C_HIGH_RES : DARK_INK.ADAPTIVE_C_LOW_RES;

    const darkInkAdaptive = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('adaptiveThreshold', maxChannel, darkInkAdaptive, 255, 1, 1, darkInkBlockSize, darkInkC);

    // Low saturation (not colored) AND absolutely dark
    const lowSatMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', saturation, lowSatMask, DARK_INK.LOW_SAT_THRESHOLD, 255, 1);
    const absoluteDarkMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', maxChannel, absoluteDarkMask, DARK_INK.ABSOLUTE_DARK_THRESHOLD, 255, 1);

    // Combine: locally dark AND absolutely dark AND not colored
    const darkInkMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', darkInkAdaptive, lowSatMask, darkInkMask);
    OpenCV.invoke('bitwise_and', darkInkMask, absoluteDarkMask, darkInkMask);

    // Exclude color mask areas
    const notColorMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', colorMaskDilated, notColorMask);
    OpenCV.invoke('bitwise_and', darkInkMask, notColorMask, darkInkMask);

    // Dilate to cover ink edges
    const darkInkDilateKernel = OpenCV.invoke('getStructuringElement', 2, createSize(DARK_INK.DILATE_KERNEL_SIZE, DARK_INK.DILATE_KERNEL_SIZE));
    const darkInkMaskDilated = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', darkInkMask, darkInkMaskDilated, 1, darkInkDilateKernel);

    if (enableDebugImages) {
      const inkBGR = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', darkInkMaskDilated, inkBGR, 8, 0);
      const r = OpenCV.toJSValue(inkBGR);
      if (r?.base64) stepImages.push({ label: '2.5. Dark ink mask', image: r.base64 });
    }

    // === 6. (BRIGHTNESS already checked at step 3.1) ===

    if (enableDebugImages) {
      const grayBGR = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', grayMat, grayBGR, 8, 0);
      const r = OpenCV.toJSValue(grayBGR);
      if (r?.base64) stepImages.push({ label: '3. Grayscale', image: r.base64 });
    }

    // === 7. ICON DETECTION — bottom 5% strip, 7 columns ===
    console.log('🎯 Detecting icons');
    const bottomPadding = Math.round(cropHeight * ICONS.BOTTOM_PADDING_RATIO);
    const bottom5Height = Math.round(cropHeight * ICONS.STRIP_HEIGHT_RATIO);
    const bottom5StartY = cropHeight - bottom5Height - bottomPadding;
    const marginLeft = Math.round(cropWidth * ICONS.MARGIN_RATIO);
    const marginRight = Math.round(cropWidth * ICONS.MARGIN_RATIO);
    const usableWidth = cropWidth - marginLeft - marginRight;
    const sliceWidth = Math.round(usableWidth / ICONS.COLUMN_COUNT);

    const bottom5GrayRect = OpenCV.createObject(ObjectType.Rect, 0, bottom5StartY, cropWidth, bottom5Height);
    const bottom5Gray = OpenCV.createObject(ObjectType.Mat, bottom5Height, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('crop', grayMat, bottom5Gray, bottom5GrayRect);

    const DARK_THRESHOLD = ICONS.DARK_THRESHOLD;
    const PIXEL_DARK_VALUE = ICONS.PIXEL_DARK_VALUE;
    const iconNames = ['Nyíl', 'Gyémánt', 'Alma', 'Csengő', 'Lóhere', 'Csillag', 'Patkó'];
    const iconActive: boolean[] = [];
    const iconDarkPercents: number[] = [];

    for (let i = 0; i < 7; i++) {
      const sliceX = marginLeft + i * sliceWidth;
      const sliceW = Math.min(sliceWidth, cropWidth - sliceX);
      const sliceRect = OpenCV.createObject(ObjectType.Rect, sliceX, 0, sliceW, bottom5Height);
      const sliceMat = OpenCV.createObject(ObjectType.Mat, bottom5Height, sliceW, DataTypes.CV_8UC1);
      OpenCV.invoke('crop', bottom5Gray, sliceMat, sliceRect);

      const threshMat = OpenCV.createObject(ObjectType.Mat, bottom5Height, sliceW, DataTypes.CV_8UC1);
      OpenCV.invoke('threshold', sliceMat, threshMat, PIXEL_DARK_VALUE, 255, 1);

      const meanScalar = OpenCV.invoke('mean', threshMat);
      const md = OpenCV.toJSValue(meanScalar);
      const darkPercent = ((md?.a ?? 0) / 255) * 100;
      const isActive = darkPercent > DARK_THRESHOLD;
      iconActive.push(isActive);
      iconDarkPercents.push(Math.round(darkPercent * 10) / 10);
    }

    const detectedIcons = iconActive.map((a, i) => a ? i : -1).filter(i => i >= 0);
    const detectedIconNames = iconActive.reduce<string[]>((acc, a, i) => { if (a) acc.push(iconNames[i]); return acc; }, []);
    console.log('Icons:', iconActive.map((a, i) => `${iconNames[i]}:${a ? 'ON' : 'off'}`).join(' '));

    // === 8. QR CODE DETECTION & SMART CROP ===
    console.log('✂️ Smart cropping — QR detection');
    let qrEndY = cropHeight;
    let qrDetected = false;

    try {
      const searchHeight = Math.round(cropHeight * QR.SEARCH_HEIGHT_RATIO);
      const searchStartY = cropHeight - searchHeight;
      const bottomRect = OpenCV.createObject(ObjectType.Rect, 0, searchStartY, cropWidth, searchHeight);
      const bottomMat = OpenCV.createObject(ObjectType.Mat, searchHeight, cropWidth, DataTypes.CV_8UC1);
      OpenCV.invoke('crop', grayMat, bottomMat, bottomRect);

      const threshMat = OpenCV.createObject(ObjectType.Mat, searchHeight, cropWidth, DataTypes.CV_8UC1);
      OpenCV.invoke('threshold', bottomMat, threshMat, QR.BINARY_THRESHOLD, 255, 1);

      const contours = OpenCV.createObject(ObjectType.MatVector);
      OpenCV.invoke('findContours', threshMat, contours, RetrievalModes.RETR_EXTERNAL, ContourApproximationModes.CHAIN_APPROX_SIMPLE);
      const contoursData = OpenCV.toJSValue(contours);
      const contoursSize = contoursData?.array?.length || 0;

      let bestQrContour: { x: number; y: number; width: number; height: number } | null = null;
      let bestQrArea = 0;
      const minQrSize = cropWidth * QR.MIN_SIZE_RATIO;
      const maxQrSize = cropWidth * QR.MAX_SIZE_RATIO;

      for (let i = 0; i < contoursSize; i++) {
        const contour = OpenCV.copyObjectFromVector(contours, i);
        const boundingRect = OpenCV.invoke('boundingRect', contour);
        const rectData = OpenCV.toJSValue(boundingRect);
        if (!rectData) continue;

        const { x, y, width: w, height: h } = rectData;
        const area = w * h;
        const aspectRatio = w / h;
        const isSquare = aspectRatio >= QR.ASPECT_RATIO_MIN && aspectRatio <= QR.ASPECT_RATIO_MAX;
        const isCorner = x < cropWidth * QR.CORNER_ZONE_RATIO || (x + w) > cropWidth * (1 - QR.CORNER_ZONE_RATIO);
        const isAtBottom = (y + h) > searchHeight * QR.BOTTOM_ZONE_RATIO;
        const isSizeOk = area >= minQrSize * minQrSize && area <= maxQrSize * maxQrSize;

        if (isSquare && isSizeOk && isCorner && isAtBottom && area > bestQrArea) {
          bestQrArea = area;
          bestQrContour = { x, y: y + searchStartY, width: w, height: h };
        }
      }

      if (bestQrContour) {
        qrEndY = bestQrContour.y;
        qrDetected = true;
        console.log(`✅ QR found at Y=${qrEndY}, size=${bestQrContour.width}x${bestQrContour.height}`);
      } else {
        qrEndY = Math.round(cropHeight * QR.FALLBACK_HEIGHT_RATIO);
        console.log(`⚠️ QR not found, using fallback ${QR.FALLBACK_HEIGHT_RATIO * 100}%`);
      }
    } catch (qrError) {
      console.warn('⚠️ QR detection error:', qrError);
      qrEndY = Math.round(cropHeight * QR.FALLBACK_HEIGHT_RATIO);
    }

    // Calculate final height
    const margin = Math.round(cropHeight * CROP.QR_MARGIN_RATIO);
    let finalHeight: number;
    if (qrDetected) {
      finalHeight = qrEndY - margin;
      finalHeight = Math.max(finalHeight, Math.round(cropHeight * CROP.MIN_HEIGHT_RATIO));
      finalHeight = Math.min(finalHeight, Math.round(cropHeight * CROP.MAX_HEIGHT_RATIO));
    } else {
      finalHeight = Math.round(cropHeight * QR.FALLBACK_HEIGHT_RATIO);
    }

    // Debug: zone visualization
    if (enableDebugImages) {
      const zoneDebugMat = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', grayMat, zoneDebugMat, 8, 0);

      for (let i = 0; i < ICONS.COLUMN_COUNT; i++) {
        const sliceX = marginLeft + i * sliceWidth;
        const sliceW = Math.min(sliceWidth, cropWidth - sliceX);
        const r = iconActive[i] ? 0 : 255;
        const g = iconActive[i] ? 255 : 0;
        const color = OpenCV.createObject(ObjectType.Scalar, 0, g, r, 255);
        const tl = OpenCV.createObject(ObjectType.Point, sliceX, bottom5StartY);
        const tr = OpenCV.createObject(ObjectType.Point, sliceX + sliceW, bottom5StartY);
        const br = OpenCV.createObject(ObjectType.Point, sliceX + sliceW, bottom5StartY + bottom5Height);
        const bl = OpenCV.createObject(ObjectType.Point, sliceX, bottom5StartY + bottom5Height);
        OpenCV.invoke('line', zoneDebugMat, tl, tr, color, 6, 8);
        OpenCV.invoke('line', zoneDebugMat, tr, br, color, 6, 8);
        OpenCV.invoke('line', zoneDebugMat, br, bl, color, 6, 8);
        OpenCV.invoke('line', zoneDebugMat, bl, tl, color, 6, 8);
      }

      const yellowColor = OpenCV.createObject(ObjectType.Scalar, 0, 255, 255, 255);
      OpenCV.invoke('line', zoneDebugMat,
        OpenCV.createObject(ObjectType.Point, 0, finalHeight),
        OpenCV.createObject(ObjectType.Point, cropWidth, finalHeight),
        yellowColor, 8, 8);

      const magenta = OpenCV.createObject(ObjectType.Scalar, 255, 0, 255, 255);
      const fb90 = Math.round(cropHeight * QR.FALLBACK_HEIGHT_RATIO);
      OpenCV.invoke('line', zoneDebugMat,
        OpenCV.createObject(ObjectType.Point, 0, fb90),
        OpenCV.createObject(ObjectType.Point, cropWidth, fb90),
        magenta, 4, 8);

      const zr = OpenCV.toJSValue(zoneDebugMat);
      if (zr?.base64) stepImages.push({ label: `3. Zones QR:${qrDetected ? 'YES' : 'NO'}`, image: zr.base64 });
    }

    // === 9. CROP — bottom (QR) + edge border ===
    const edgeCropPercent = CROP.EDGE_CROP_PERCENT;
    const edgeCropLeft = Math.round(cropWidth * edgeCropPercent);
    const edgeCropTop = Math.round(finalHeight * edgeCropPercent);
    const edgeCropWidth = cropWidth - 2 * edgeCropLeft;
    const edgeCropHeight = finalHeight - 2 * edgeCropTop;

    // Combined crop rect: edge crop within the finalHeight region
    const finalCombinedRect = OpenCV.createObject(ObjectType.Rect, edgeCropLeft, edgeCropTop, edgeCropWidth, edgeCropHeight);

    // === 10. COMPOSE — white background + dark ink + color from original ===
    console.log('🎨 Composing final image: white + ink + color');

    // Crop masks and original to final dimensions
    const colorMaskCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('crop', colorMaskDilated, colorMaskCropped, finalCombinedRect);
    const darkInkMaskCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('crop', darkInkMaskDilated, darkInkMaskCropped, finalCombinedRect);
    const originalCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('crop', croppedMat, originalCropped, finalCombinedRect);

    // White background via convertScaleAbs(src, dst, 0, 255) — guaranteed all 255
    const whiteBg = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', originalCropped, whiteBg, 0, 255);

    // Remove color areas from dark ink (color has priority)
    const notColorCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', colorMaskCropped, notColorCropped);
    const cleanDarkInk = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', darkInkMaskCropped, notColorCropped, cleanDarkInk);

    // Combined mask = dark ink | color
    const combinedMask = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_or', cleanDarkInk, colorMaskCropped, combinedMask);

    // Original pixels where mask is active
    const maskedPixels = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', originalCropped, originalCropped, maskedPixels, combinedMask);

    // White pixels where mask is NOT active
    const inverseMask = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', combinedMask, inverseMask);
    const whiteParts = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', whiteBg, whiteBg, whiteParts, inverseMask);

    // Final = white + masked pixels
    const finalMat = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', whiteParts, maskedPixels, finalMat);

    console.log(`✅ Final: ${edgeCropWidth}x${edgeCropHeight}`);

    // === 11. EXPORT ===
    const result = OpenCV.toJSValue(finalMat);
    if (!result?.base64) {
      throw new Error('Failed to convert scanned image to base64');
    }

    if (enableDebugImages) {
      stepImages.push({ label: `10. Final${currentQrValue ? ` — QR: ${currentQrValue}` : ''}`, image: result.base64 });
    }

    return {
      success: true,
      imageBase64: result.base64,
      stepImages: enableDebugImages ? stepImages : [],
      qrValue: currentQrValue,
      qrPosition: currentQrPosition,
      brightnessInfo: { avgBrightness, lightCondition, betaBoost: 0 },
      selectedIcons: detectedIcons,
      selectedIconNames: detectedIconNames,
      iconAnalysis: iconActive.map((a, i) => ({ slot: i + 1, icon: iconNames[i], active: a, darkPercent: iconDarkPercents[i] })),
    };
  } catch (error) {
    console.error('Scan error:', error);
    try { OpenCV.clearBuffers(); } catch (_) {}
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    try { OpenCV.clearBuffers(); } catch (_) {}
  }
};
