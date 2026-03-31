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

// === CONFIGURATION - SYNCHRONIZED WITH useInferenceLogic.tsx ===
const ENABLE_DEBUG_IMAGES = false; // Set to true to enable debug image generation (slow!)
const MIN_AREA_RATIO = 0.001; // 0.1% - fotó downscale után nagyon kicsik a contourok
const MAX_AREA_RATIO = 0.95;
const CROP_MARGIN_RATIO = 0; // Disabled - ne zárjon ki szél közeli kontúrokat
const MIN_PORTRAIT_ASPECT_RATIO = 0.9;
const TARGET_ASPECT_RATIO = 5.0 / 3.0;
const MAX_ASPECT_RATIO_DIFF = 1.5;
const MAX_HORIZONTAL_RATIO = 5.0;
const MAX_VERTICAL_RATIO = 5.0;
const ADAPTIVE_THRESHOLD_BLOCK_SIZE = 25;
const ADAPTIVE_THRESHOLD_C = 10;
const BINARY_THRESHOLD = 100;
const CANNY_THRESHOLD_LOW = 50;
const CANNY_THRESHOLD_HIGH = 150;
const GAUSSIAN_BLUR_KERNEL_SIZE = 5;
const MORPHOLOGY_KERNEL_SIZE = 2; // Csökkentve 5-ről 2-re hogy ne olvadjon össze a dokumentum széle a háttérrel
const EPSILON_VALUES = [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05];
const SCORE_ASPECT_GOOD = 30;
const SCORE_ASPECT_OK = 15;
const SCORE_SOLIDITY_HIGH = 25;
const SCORE_SOLIDITY_MEDIUM = 15;
const SCORE_SOLIDITY_LOW = 5;
const SCORE_SIZE_LARGE = 20;
const SCORE_SIZE_MEDIUM = 10;

interface DocumentCorner {
  x: number;
  y: number;
}

interface DetectionParams {
  mat: any; // OpenCV Mat (already rotated 90° and in grayscale or BGR)
  width: number; // Rotated width
  height: number; // Rotated height
  alpha: number; // Brightness alpha
  beta: number; // Brightness beta
}

interface DetectionResult {
  corners: DocumentCorner[] | null;
  confidence: number;
  debugInfo?: string;
  debugImage?: string; // Base64 encoded debug image (downscaled)
  debugGray?: string; // Grayscale
  debugBrightened?: string; // After brightness adjustment
  debugAdaptive?: string; // Adaptive threshold
  debugBinary?: string; // Binary threshold
  debugBlurred?: string; // Gaussian blur
  debugMorph?: string; // Morphological closing
  debugCanny?: string; // Canny edges
  debugCombined?: string; // Combined edges (binary + canny)
  debugContours?: string; // All detected contours drawn
}

const calculateDistance = (p1: DocumentCorner, p2: DocumentCorner): number => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const orderCorners = (corners: DocumentCorner[]): DocumentCorner[] => {
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

const correctToRectangle = (corners: DocumentCorner[]): DocumentCorner[] => {
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

const validateDocumentPerspective = (
  corners: DocumentCorner[],
): {
  isValid: boolean;
  correctedCorners?: DocumentCorner[];
  qualityScore: number;
  isPoorQuality: boolean;
} => {
  if (corners.length !== 4) {
    return {
      isValid: false,
      qualityScore: 0,
      isPoorQuality: true,
    };
  }

  const ordered = orderCorners(corners);

  const width =
    (calculateDistance(ordered[0], ordered[1]) +
      calculateDistance(ordered[3], ordered[2])) /
    2;
  const height =
    (calculateDistance(ordered[0], ordered[3]) +
      calculateDistance(ordered[1], ordered[2])) /
    2;

  if (width < 1 || height < 1) {
    return {
      isValid: false,
      qualityScore: 0,
      isPoorQuality: true,
    };
  }

  const currentAspectRatio = height / width;
  const targetAspectRatio = TARGET_ASPECT_RATIO;
  const aspectRatioDiff = Math.abs(currentAspectRatio - targetAspectRatio);

  const topSide = calculateDistance(ordered[0], ordered[1]);
  const bottomSide = calculateDistance(ordered[3], ordered[2]);
  const leftSide = calculateDistance(ordered[0], ordered[3]);
  const rightSide = calculateDistance(ordered[1], ordered[2]);

  const horizontalRatio =
    Math.max(topSide, bottomSide) / Math.min(topSide, bottomSide);
  const verticalRatio =
    Math.max(leftSide, rightSide) / Math.min(leftSide, rightSide);

  let qualityScore = 100;

  const aspectPenalty = Math.min(aspectRatioDiff * 40, 40);
  qualityScore -= aspectPenalty;

  const horizontalPenalty = Math.min((horizontalRatio - 1.0) * 15, 20);
  const verticalPenalty = Math.min((verticalRatio - 1.0) * 15, 20);
  qualityScore -= horizontalPenalty + verticalPenalty;

  const isPoorQuality =
    aspectRatioDiff > 1.2 && (horizontalRatio > 3.5 || verticalRatio > 3.5);

  if (aspectRatioDiff > MAX_ASPECT_RATIO_DIFF) {
    const correctedCorners = correctToRectangle(ordered);
    return {
      isValid: true,
      correctedCorners,
      qualityScore: Math.max(qualityScore, 0),
      isPoorQuality,
    };
  }

  if (
    horizontalRatio > MAX_HORIZONTAL_RATIO ||
    verticalRatio > MAX_VERTICAL_RATIO
  ) {
    const correctedCorners = correctToRectangle(ordered);
    return {
      isValid: true,
      correctedCorners,
      qualityScore: Math.max(qualityScore, 0),
      isPoorQuality,
    };
  }

  return {
    isValid: true,
    qualityScore: Math.max(qualityScore, 0),
    isPoorQuality,
  };
};

/**
 * Detect document corners from an OpenCV Mat
 * STRATEGY: Downscale photo to frame size, use EXACT same detection as useInferenceLogic.tsx, then upscale corners back
 * @param params Detection parameters (mat, dimensions, brightness settings)
 * @returns Detection result with corners and confidence
 */
export const detectDocumentCorners = (
  params: DetectionParams,
): DetectionResult => {
  const { mat, width: photoWidth, height: photoHeight, alpha, beta } = params;

  try {
    // === STEP 1: DOWNSCALE photo to frame resolution ===
    const FRAME_WIDTH = 720;  // Frame resolution after 90° rotation
    const FRAME_HEIGHT = 1280;
    
    console.log(`� Downscaling photo from ${photoWidth}x${photoHeight} to ${FRAME_WIDTH}x${FRAME_HEIGHT}`);
    
    const downscaled = OpenCV.createObject(
      ObjectType.Mat,
      FRAME_HEIGHT,
      FRAME_WIDTH,
      DataTypes.CV_8UC3,
    );
    const dsize = OpenCV.createObject(ObjectType.Size, FRAME_WIDTH, FRAME_HEIGHT);
    OpenCV.invoke('resize', mat, downscaled, dsize, 0, 0, 3); // 3 = INTER_AREA (best for downscaling)
    
    let debugDownscaledImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      console.log('📸 Downscaled image created - returning as debugImage');
      const downscaledRGB = OpenCV.createObject(
        ObjectType.Mat,
        FRAME_HEIGHT,
        FRAME_WIDTH,
        DataTypes.CV_8UC3,
      );
      OpenCV.invoke('cvtColor', downscaled, downscaledRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const downscaledResult = OpenCV.toJSValue(downscaledRGB);
      debugDownscaledImage = downscaledResult?.base64 || null;
    }
    
    // === STEP 2: Run EXACT SAME detection as useInferenceLogic.tsx ===
    // Convert to grayscale
    const gray = OpenCV.createObject(
      ObjectType.Mat,
      FRAME_HEIGHT,
      FRAME_WIDTH,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('cvtColor', downscaled, gray, ColorConversionCodes.COLOR_BGR2GRAY);

    let debugGrayImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const grayRGB = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', gray, grayRGB, ColorConversionCodes.COLOR_GRAY2BGR);
      OpenCV.invoke('cvtColor', grayRGB, grayRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const grayDebug = OpenCV.toJSValue(grayRGB);
      debugGrayImage = grayDebug?.base64 || null;
    }

    // Apply brightness adjustment (using provided alpha/beta)
    const brightened = OpenCV.createObject(
      ObjectType.Mat,
      FRAME_HEIGHT,
      FRAME_WIDTH,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('convertScaleAbs', gray, brightened, alpha, beta);

    let debugBrightenedImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const brightenedRGB = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', brightened, brightenedRGB, ColorConversionCodes.COLOR_GRAY2BGR);
      OpenCV.invoke('cvtColor', brightenedRGB, brightenedRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const brightenedDebug = OpenCV.toJSValue(brightenedRGB);
      debugBrightenedImage = brightenedDebug?.base64 || null;
    }

    const cropMarginW = Math.floor(FRAME_WIDTH * CROP_MARGIN_RATIO);
    const cropMarginH = Math.floor(FRAME_HEIGHT * CROP_MARGIN_RATIO);

    const imgArea = FRAME_WIDTH * FRAME_HEIGHT;
    const minArea = imgArea * MIN_AREA_RATIO;
    const maxArea = imgArea * MAX_AREA_RATIO;

    // Adaptive threshold
    const enhanced = OpenCV.createObject(
      ObjectType.Mat,
      FRAME_HEIGHT,
      FRAME_WIDTH,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke(
      'adaptiveThreshold',
      brightened,
      enhanced,
      255,
      AdaptiveThresholdTypes.ADAPTIVE_THRESH_MEAN_C,
      ThresholdTypes.THRESH_BINARY,
      ADAPTIVE_THRESHOLD_BLOCK_SIZE,
      ADAPTIVE_THRESHOLD_C,
    );

    let debugAdaptiveImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const adaptiveRGB = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', enhanced, adaptiveRGB, ColorConversionCodes.COLOR_GRAY2BGR);
      OpenCV.invoke('cvtColor', adaptiveRGB, adaptiveRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const adaptiveDebug = OpenCV.toJSValue(adaptiveRGB);
      debugAdaptiveImage = adaptiveDebug?.base64 || null;
    }

    // Binary threshold
    const binary = OpenCV.createObject(
      ObjectType.Mat,
      FRAME_HEIGHT,
      FRAME_WIDTH,
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

    let debugBinaryImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const binaryRGB = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', binary, binaryRGB, ColorConversionCodes.COLOR_GRAY2BGR);
      OpenCV.invoke('cvtColor', binaryRGB, binaryRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const binaryDebug = OpenCV.toJSValue(binaryRGB);
      debugBinaryImage = binaryDebug?.base64 || null;
    }

    // Gaussian blur
    const blurred = OpenCV.createObject(
      ObjectType.Mat,
      FRAME_HEIGHT,
      FRAME_WIDTH,
      DataTypes.CV_8UC1,
    );
    const ksize = OpenCV.createObject(ObjectType.Size, GAUSSIAN_BLUR_KERNEL_SIZE, GAUSSIAN_BLUR_KERNEL_SIZE);
    OpenCV.invoke('GaussianBlur', brightened, blurred, ksize, 0);

    let debugBlurredImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const blurredRGB = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', blurred, blurredRGB, ColorConversionCodes.COLOR_GRAY2BGR);
      OpenCV.invoke('cvtColor', blurredRGB, blurredRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const blurredDebug = OpenCV.toJSValue(blurredRGB);
      debugBlurredImage = blurredDebug?.base64 || null;
    }

    // Morphological closing
    const kernelSize = OpenCV.createObject(ObjectType.Size, MORPHOLOGY_KERNEL_SIZE, MORPHOLOGY_KERNEL_SIZE);
    const kernel = OpenCV.invoke('getStructuringElement', MorphShapes.MORPH_RECT, kernelSize);
    OpenCV.invoke('morphologyEx', binary, binary, MorphTypes.MORPH_CLOSE, kernel);

    let debugMorphImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const morphRGB = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', binary, morphRGB, ColorConversionCodes.COLOR_GRAY2BGR);
      OpenCV.invoke('cvtColor', morphRGB, morphRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const morphDebug = OpenCV.toJSValue(morphRGB);
      debugMorphImage = morphDebug?.base64 || null;
    }

    // Canny edge detection
    const edges = OpenCV.createObject(
      ObjectType.Mat,
      FRAME_HEIGHT,
      FRAME_WIDTH,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('Canny', blurred, edges, CANNY_THRESHOLD_LOW, CANNY_THRESHOLD_HIGH);

    let debugCannyImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const cannyRGB = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', edges, cannyRGB, ColorConversionCodes.COLOR_GRAY2BGR);
      OpenCV.invoke('cvtColor', cannyRGB, cannyRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const cannyDebug = OpenCV.toJSValue(cannyRGB);
      debugCannyImage = cannyDebug?.base64 || null;
    }

    // SKIP combining binary and edges - use ONLY Canny edges for contour detection
    // Reason: binary threshold causes morphology closing to merge document edges with background
    // OpenCV.invoke('bitwise_or', binary, edges, edges);
    
    // DILATE - Vonalak összezárása (mint useInferenceLogic.tsx-ben)
    // Ez segít, hogy a megszakadt élek összeérjenek és zárt kontúrt alkossanak
    const dilateKernelSize = OpenCV.createObject(ObjectType.Size, 3, 3);
    const dilateKernel = OpenCV.invoke(
      'getStructuringElement',
      MorphShapes.MORPH_RECT,
      dilateKernelSize,
    );
    OpenCV.invoke(
      'morphologyEx',
      edges,
      edges,
      MorphTypes.MORPH_DILATE,
      dilateKernel,
    );

    // Use edges (Canny + dilate) for contour detection
    const finalEdges = edges;

    let debugCombinedImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const combinedRGB = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', finalEdges, combinedRGB, ColorConversionCodes.COLOR_GRAY2BGR);
      OpenCV.invoke('cvtColor', combinedRGB, combinedRGB, ColorConversionCodes.COLOR_BGR2RGB);
      const combinedDebug = OpenCV.toJSValue(combinedRGB);
      debugCombinedImage = combinedDebug?.base64 || null;
    }

    // Find contours
    const contours = OpenCV.createObject(ObjectType.MatVector);
    OpenCV.invoke(
      'findContours',
      finalEdges,
      contours,
      RetrievalModes.RETR_EXTERNAL,
      ContourApproximationModes.CHAIN_APPROX_SIMPLE,
    );

    const contoursData = OpenCV.toJSValue(contours);
    const contoursSize = contoursData.array.length;

    // ABSOLUTE MINIMUM: Document must be at least 10% of image area
    const MINIMUM_DOCUMENT_AREA_RATIO = 0.10;
    const absoluteMinArea = imgArea * MINIMUM_DOCUMENT_AREA_RATIO;
    
    console.log(`🔍 Found ${contoursSize} contours at frame resolution. Area range: ${minArea.toFixed(0)} - ${maxArea.toFixed(0)}, ABSOLUTE MIN (10%): ${absoluteMinArea.toFixed(0)}`);

    let debugContoursImage: string | null = null;
    if (ENABLE_DEBUG_IMAGES) {
      const contoursDebugMat = OpenCV.createObject(ObjectType.Mat, FRAME_HEIGHT, FRAME_WIDTH, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', downscaled, contoursDebugMat, ColorConversionCodes.COLOR_BGR2RGB);
      const greenScalar = OpenCV.createObject(ObjectType.Scalar, 0, 255, 0, 255);
      OpenCV.invoke('drawContours', contoursDebugMat, contours, -1, greenScalar, 2, 8);
      const contoursDebugResult = OpenCV.toJSValue(contoursDebugMat);
      debugContoursImage = contoursDebugResult?.base64 || null;
    }

    // === STEP 3: Process contours (EXACT COPY from useInferenceLogic.tsx) ===
    let documentContour = null;
    let maxValidArea = 0;
    let bestContourScore = 0;
    let validContourCount = 0;
    let edgeFilterCount = 0;
    let aspectFilterCount = 0;
    let bestCornerCount = 0; // Track best corner count we found
    let tooSmallCount = 0;
    let tooBigCount = 0;

    for (let i = 0; i < contoursSize; i++) {
      const contour = OpenCV.copyObjectFromVector(contours, i);
      const areaResult = OpenCV.invoke('contourArea', contour);
      
      // Debug: log the full structure of areaResult for first contour
      if (i === 0) {
        console.log(`🔍 FULL areaResult structure:`, JSON.stringify(areaResult));
        console.log(`🔍 areaResult keys:`, areaResult && typeof areaResult === 'object' ? Object.keys(areaResult) : 'not object');
      }
      
      // Handle different return types from contourArea
      // Try multiple ways to extract the value
      let area: number;
      if (typeof areaResult === 'number') {
        area = areaResult;
      } else if (areaResult && typeof areaResult === 'object') {
        // Try different possible property names
        area = areaResult.value ?? areaResult.area ?? areaResult.result ?? 
               (typeof areaResult[0] === 'number' ? areaResult[0] : 0);
        // If still 0 or very small, try toJSValue
        if (area < 100) {
          try {
            const jsValue = OpenCV.toJSValue(areaResult);
            if (i === 0) {
              console.log(`🔍 toJSValue result:`, JSON.stringify(jsValue), typeof jsValue);
            }
            if (typeof jsValue === 'number') {
              area = jsValue;
            } else if (jsValue && typeof jsValue === 'object') {
              area = jsValue.value ?? jsValue.area ?? jsValue[0] ?? 0;
            }
          } catch (e) {
            // toJSValue failed, keep previous value
          }
        }
      } else {
        area = 0;
      }
      
      // Debug first few contours
      if (i < 3) {
        console.log(`🔍 Contour #${i} area:`, { area, type: typeof areaResult });
      }

      // CRITICAL: Absolute minimum check - document MUST be >= 10% of image
      if (area < absoluteMinArea) {
        tooSmallCount++;
        if (tooSmallCount <= 3) {
          const areaPercent = ((area / imgArea) * 100).toFixed(1);
          console.log(`❌ #${i}: TOO_SMALL (${areaPercent}% < 10% minimum)`);
        }
        continue;
      }

      if (area <= minArea) {
        tooSmallCount++;
        continue;
      }
      if (area >= maxArea) {
        tooBigCount++;
        continue;
      }

      {
        const boundingRect = OpenCV.invoke('boundingRect', contour);
        const rectData = OpenCV.toJSValue(boundingRect);

        // Skip contours too close to edges ONLY if they're small
        // Large contours (>10% of image) are kept even if touching edges (likely the document)
        const areaRatio = area / imgArea;
        const isTouchingEdge = (
          rectData.x <= cropMarginW ||
          rectData.y <= cropMarginH ||
          rectData.x + rectData.width >= FRAME_WIDTH - cropMarginW ||
          rectData.y + rectData.height >= FRAME_HEIGHT - cropMarginH
        );
        
        if (isTouchingEdge && areaRatio < 0.1) {
          edgeFilterCount++;
          if (edgeFilterCount <= 3) {
            console.log(`❌ #${i}: TOO_CLOSE_TO_EDGE (small: ${(areaRatio*100).toFixed(1)}%, x:${rectData.x} y:${rectData.y})`);
          }
          continue;
        }

        const perimeterResult = OpenCV.invoke('arcLength', contour, true);
        const perimeter = perimeterResult.value;
        const aspectRatio = rectData.width / rectData.height;

        // Accept both portrait AND landscape documents
        // Portrait: aspect 0.4 - 0.95 (taller than wide)
        // Landscape: aspect 1.05 - 2.5 (wider than tall)
        // Reject: ~1.0 (square-ish shapes that are likely not documents)
        const isPortrait = aspectRatio >= 0.4 && aspectRatio <= 0.95;
        const isLandscape = aspectRatio >= 1.05 && aspectRatio <= 2.5;
        if (!isPortrait && !isLandscape) {
          aspectFilterCount++;
          if (aspectFilterCount <= 3) {
            console.log(`❌ #${i}: WRONG_ASPECT (aspect:${aspectRatio.toFixed(2)}, need 0.4-0.95 portrait or 1.05-2.5 landscape, w:${rectData.width} h:${rectData.height})`);
          }
          continue;
        }

        validContourCount++;
        const boundingArea = rectData.width * rectData.height;
        const solidity = area / boundingArea;

        if (validContourCount <= 3) {
          console.log(`✅ #${i}: VALID_CONTOUR (area:${area.toFixed(0)} aspect:${aspectRatio.toFixed(2)} solidity:${solidity.toFixed(2)})`);
        }

        // Try different epsilon values
        let foundFourCorners = false;
        for (const epsMult of EPSILON_VALUES) {
          const epsilon = epsMult * perimeter;
          const approx = OpenCV.createObject(ObjectType.PointVector);
          OpenCV.invoke('approxPolyDP', contour, approx, epsilon, true);

          const approxData = OpenCV.toJSValue(approx);
          const cornerCount = approxData.array.length;
          
          if (validContourCount <= 3 && !foundFourCorners) {
            console.log(`   ↳ eps:${epsMult} → ${cornerCount} corners`);
          }

          if (cornerCount === 4) {
            foundFourCorners = true;
            bestCornerCount++;
            if (validContourCount <= 3) {
              console.log(`   ✅ 4 CORNERS FOUND with eps:${epsMult}!`);
            }
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
              minDim > FRAME_WIDTH * 0.08 &&
              minDim > FRAME_HEIGHT * 0.08
            ) {
              score += SCORE_SIZE_LARGE;
            } else if (
              minDim > FRAME_WIDTH * 0.04 &&
              minDim > FRAME_HEIGHT * 0.04
            ) {
              score += SCORE_SIZE_MEDIUM;
            }

            // Túl nagy contour büntetése - ha >70% a kép területe, valószínűleg
            // a háttér (asztal/padló) és nem a dokumentum
            const areaRatioScore = area / imgArea;
            if (areaRatioScore > 0.7) {
              score -= 30;
            } else if (areaRatioScore > 0.5) {
              score -= 10;
            }

            if (score > bestContourScore) {
              documentContour = approx;
              maxValidArea = area;
              bestContourScore = score;
            }
            break;
          }
        }
        
        if (validContourCount <= 3 && !foundFourCorners) {
          console.log(`   ❌ NO 4-CORNER MATCH`);
        }
      }
    }

    // === STEP 4: Process found contour and UPSCALE back to photo resolution ===
    if (documentContour) {
      const contourData = OpenCV.toJSValue(documentContour);
      const frameCorners: DocumentCorner[] = contourData.array.map(
        (point: any) => ({
          x: point.x,
          y: point.y,
        }),
      );

      if (frameCorners.length === 4) {
        const validation = validateDocumentPerspective(frameCorners);

        if (validation.isValid) {
          const finalFrameCorners = validation.correctedCorners || frameCorners;
          const orderedFrameCorners = orderCorners(finalFrameCorners);

          // UPSCALE corners from frame resolution back to photo resolution
          const scaleX = photoWidth / FRAME_WIDTH;
          const scaleY = photoHeight / FRAME_HEIGHT;

          const photoCorners = orderedFrameCorners.map(p => ({
            x: Math.round(p.x * scaleX),
            y: Math.round(p.y * scaleY),
          }));

          const confidence = Math.min(maxValidArea / (imgArea * 0.2), 1.0);

          console.log(`✅ Photo detection SUCCESS! Upscaled ${FRAME_WIDTH}x${FRAME_HEIGHT} -> ${photoWidth}x${photoHeight} (scale: ${scaleX.toFixed(2)}x, ${scaleY.toFixed(2)}x)`);

          return {
            corners: photoCorners,
            confidence,
            debugInfo: `Quality: ${validation.qualityScore.toFixed(0)}, Upscaled: ${scaleX.toFixed(2)}x`,
            debugImage: debugDownscaledImage || undefined,
            debugGray: debugGrayImage || undefined,
            debugBrightened: debugBrightenedImage || undefined,
            debugAdaptive: debugAdaptiveImage || undefined,
            debugBinary: debugBinaryImage || undefined,
            debugBlurred: debugBlurredImage || undefined,
            debugMorph: debugMorphImage || undefined,
            debugCanny: debugCannyImage || undefined,
            debugCombined: debugCombinedImage || undefined,
            debugContours: debugContoursImage || undefined,
          };
        }
      }
    }

    // No valid document found
    console.log(`❌ Photo detection failed: ${contoursSize} contours → ${tooSmallCount} tooSmall, ${tooBigCount} tooBig, ${edgeFilterCount} tooCloseEdge, ${aspectFilterCount} wrongAspect, ${validContourCount} valid, ${bestCornerCount} with4Corners`);
    return {
      corners: null,
      confidence: 0,
      debugInfo: 'No valid document found',
      debugImage: debugDownscaledImage || undefined,
      debugGray: debugGrayImage || undefined,
      debugBrightened: debugBrightenedImage || undefined,
      debugAdaptive: debugAdaptiveImage || undefined,
      debugBinary: debugBinaryImage || undefined,
      debugBlurred: debugBlurredImage || undefined,
      debugMorph: debugMorphImage || undefined,
      debugCanny: debugCannyImage || undefined,
      debugCombined: debugCombinedImage || undefined,
      debugContours: debugContoursImage || undefined,
    };
  } catch (error) {
    console.error('detectDocumentCorners error:', error);
    return {
      corners: null,
      confidence: 0,
      debugInfo: `Error: ${error}`,
    };
  }
};
