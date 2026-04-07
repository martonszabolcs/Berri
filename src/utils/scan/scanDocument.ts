import { Alert, Platform } from 'react-native';
import { OpenCV, ObjectType, DataTypes, ColorConversionCodes, RetrievalModes, ContourApproximationModes } from 'react-native-fast-opencv';
import { detectDocumentCorners } from './detectDocumentCorners';
import { scanMaskConfig, ScanMaskConfig } from './scanConfig';

interface DocumentCorner {
  x: number;
  y: number;
}

interface ScanDocumentParams {
  rawImageBase64: string;
  frameCorners: DocumentCorner[]; // Frame-ből detektált sarkok (eredeti detektálás)
  processedCorners: DocumentCorner[]; // Teljes felbontású fotóhoz felskálázott sarkok (useInferenceLogic-ból)
  currentQrValue?: string | null; // QR kód tartalma (rawValue)
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
  frameBrightness?: number; // Frame detection brightness (from seekerInfo)
  enableDebugImages?: boolean; // Enable/disable debug step images (default: true)
  maskConfig?: Partial<ScanMaskConfig>; // Override scan mask config values per-call
}

interface ScanDocumentResult {
  success: boolean;
  imageBase64?: string;
  stepImages?: { label: string; image: string }[]; // Array of processing step images
  error?: string;
  qrValue?: string | null; // QR kód tartalma
  qrPosition?: 'left' | 'right' | null; // QR kód pozíciója
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
  edgeCorrectionInfo?: string;
}

const SCALE_FACTOR = 1.0;
const CROP_PERCENT = 0; // Disabled - no crop

// Target output resolution - A4-like at 300 DPI equivalent
// 5:3 aspect ratio (BERRĪ notebook), high resolution output
const TARGET_OUTPUT_WIDTH = 2100;  // ~300 DPI width
const TARGET_OUTPUT_HEIGHT = 3500; // ~300 DPI height (5:3 ratio)

const createMat = (h: number, w: number, type: number) =>
  OpenCV.createObject(ObjectType.Mat, h, w, type);

/**
 * Find the closest point on the contour to a target point.
 */
const findClosestContourPoint = (
  contourPoints: DocumentCorner[],
  target: DocumentCorner,
): DocumentCorner => {
  let closest = contourPoints[0];
  let minDist = Infinity;
  for (const p of contourPoints) {
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d < minDist) {
      minDist = d;
      closest = p;
    }
  }
  return closest;
};

/**
 * Calculate signed distance from a point to a line defined by two points.
 * Positive = point is to the LEFT of the line (A→B direction).
 * Negative = point is to the RIGHT.
 */
const pointToLineSignedDist = (
  point: DocumentCorner,
  lineA: DocumentCorner,
  lineB: DocumentCorner,
): number => {
  const dx = lineB.x - lineA.x;
  const dy = lineB.y - lineA.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  // Cross product gives signed distance * length
  return ((point.x - lineA.x) * dy - (point.y - lineA.y) * dx) / len;
};

/**
 * Correct corners using contour midpoint analysis.
 * For each edge (corner[i] → corner[j]), find the contour midpoint and check
 * if it deviates inward from the straight line. If it does significantly,
 * shift the problematic corner(s) inward to avoid black borders after warp.
 *
 * Corner order: [TL=0, TR=1, BR=2, BL=3]
 * Edges: top(0→1), right(1→2), bottom(2→3), left(3→0)
 */
interface MidpointCorrectionResult {
  corners: DocumentCorner[];
  debugInfo: string;
}

const correctCornersWithMidpoints = (
  corners: DocumentCorner[],
  contourPoints: DocumentCorner[],
): MidpointCorrectionResult => {
  const debugLines: string[] = [];
  debugLines.push(`Contour points: ${contourPoints.length}`);

  if (contourPoints.length < 8) {
    console.log('⚠️ Too few contour points for midpoint correction');
    debugLines.push('⚠️ Too few contour points — skipped');
    return { corners, debugInfo: debugLines.join('\n') };
  }

  const corrected = corners.map(c => ({ ...c }));

  // Edge definitions: [startCornerIdx, endCornerIdx]
  const edges: [number, number][] = [
    [0, 1], // top edge: TL → TR
    [1, 2], // right edge: TR → BR
    [2, 3], // bottom edge: BR → BL
    [3, 0], // left edge: BL → TL
  ];

  // For each edge, the "center" of the document is on the INSIDE
  // We calculate the center to determine which direction is "inward"
  const center: DocumentCorner = {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  };

    const edgeNames = ['top', 'right', 'bottom', 'left'];

  for (let ei = 0; ei < edges.length; ei++) {
    const [startIdx, endIdx] = edges[ei];
    const edgeName = edgeNames[ei];
    const startCorner = corners[startIdx];
    const endCorner = corners[endIdx];

    // Target midpoint: halfway between the two corners
    const edgeMidTarget: DocumentCorner = {
      x: (startCorner.x + endCorner.x) / 2,
      y: (startCorner.y + endCorner.y) / 2,
    };

    // Find the closest contour point to the edge midpoint
    const contourMid = findClosestContourPoint(contourPoints, edgeMidTarget);

    // Distance from contour midpoint to the corner-to-corner line
    const deviation = pointToLineSignedDist(contourMid, startCorner, endCorner);

    // Distance from center to the same line (to determine inward direction)
    const centerDist = pointToLineSignedDist(center, startCorner, endCorner);

    // The edge length for threshold calculation
    const edgeLen = Math.hypot(
      endCorner.x - startCorner.x,
      endCorner.y - startCorner.y,
    );

    // Threshold: deviation must be > 1.5% of edge length to be significant
    const threshold = edgeLen * 0.015;

    // "Inward" means the midpoint is on the same side as the center
    // If deviation and centerDist have the same sign, midpoint is inward
    const isInward = Math.sign(deviation) === Math.sign(centerDist);
    const absDeviation = Math.abs(deviation);

    if (absDeviation > threshold && isInward) {
      // The contour edge bends inward at the midpoint — a corner is likely
      // pulled outward by a book cover or similar artifact.
      // Shift both corners of this edge inward by the deviation amount.
      const shiftFactor = absDeviation;

      // Direction from each corner toward the center
      const shiftStart = {
        x: (center.x - startCorner.x),
        y: (center.y - startCorner.y),
      };
      const shiftEnd = {
        x: (center.x - endCorner.x),
        y: (center.y - endCorner.y),
      };

      // Normalize
      const lenStart = Math.hypot(shiftStart.x, shiftStart.y);
      const lenEnd = Math.hypot(shiftEnd.x, shiftEnd.y);

      if (lenStart > 0 && lenEnd > 0) {
        corrected[startIdx].x += Math.round((shiftStart.x / lenStart) * shiftFactor);
        corrected[startIdx].y += Math.round((shiftStart.y / lenStart) * shiftFactor);
        corrected[endIdx].x += Math.round((shiftEnd.x / lenEnd) * shiftFactor);
        corrected[endIdx].y += Math.round((shiftEnd.y / lenEnd) * shiftFactor);

        const msg = `📐 ${edgeName} (${startIdx}→${endIdx}): ${absDeviation.toFixed(1)}px INWARD (thresh: ${threshold.toFixed(1)}px) → CORRECTED`;
        console.log(msg);
        debugLines.push(msg);
      }
    } else if (absDeviation > threshold) {
      const msg = `📐 ${edgeName} (${startIdx}→${endIdx}): ${absDeviation.toFixed(1)}px OUTWARD — OK`;
      console.log(msg);
      debugLines.push(msg);
    } else {
      debugLines.push(`📐 ${edgeName} (${startIdx}→${endIdx}): ${absDeviation.toFixed(1)}px (< ${threshold.toFixed(1)}px) — no correction`);
    }
  }

  return { corners: corrected, debugInfo: debugLines.join('\n') };
};

const createSize = (w: number, h: number) =>
  OpenCV.createObject(ObjectType.Size, w, h);

const createPoint2f = (x: number, y: number) =>
  OpenCV.createObject(ObjectType.Point2f, x, y);

export const scanDocument = (
  params: ScanDocumentParams,
): ScanDocumentResult => {
  const {
    rawImageBase64,
    frameCorners, // Frame-ből detektált sarkok
    processedCorners, // Teljes felbontású fotóhoz felskálázott sarkok
    currentQrValue, // QR kód tartalma
    currentQrPosition, // QR kód pozíciója
    photoWidth: providedWidth,
    photoHeight: providedHeight,
    frameWidth: providedFrameWidth,
    frameHeight: providedFrameHeight,
    frameBrightness = 128, // Default if not provided
    enableDebugImages = false, // Default: debug images disabled for performance
    maskConfig: maskConfigOverrides,
  } = params;

  // Merge runtime config with per-call overrides
  const cfg: ScanMaskConfig = maskConfigOverrides
    ? { ...scanMaskConfig, ...maskConfigOverrides }
    : scanMaskConfig;

  try {
    if (frameCorners.length !== 4 || processedCorners.length !== 4) {
      return {
        success: false,
        error: 'Exactly 4 corners required for both detections',
      };
    }

    const srcMat = OpenCV.base64ToMat(rawImageBase64);

    // PORTRAIT MODE ENFORCEMENT - Ha landscape fotó, forgassuk el 90°-kal
    // Portrait elvárt: width < height (pl. 2376 < 4224)
    // Landscape rossz: width > height (pl. 4224 > 2376) → 90° clockwise rotation
    let rotatedSrcMat: any;
    let photoWidth: number;
    let photoHeight: number;
    
    const originalWidth = providedWidth ?? 0;
    const originalHeight = providedHeight ?? 0;
    
    if (originalWidth > originalHeight) {
      // LANDSCAPE → Forgatás szükséges 90° clockwise
      console.log(`🔄 Photo is LANDSCAPE (${originalWidth}x${originalHeight}) - rotating 90° clockwise to PORTRAIT`);
      
      const tempRotatedMat = createMat(
        originalWidth,
        originalHeight,
        DataTypes.CV_8UC3,
      );
      OpenCV.invoke('rotate', srcMat, tempRotatedMat, 0); // 0 = ROTATE_90_CLOCKWISE
      rotatedSrcMat = OpenCV.invoke('clone', tempRotatedMat);
      
      // Dimenziók felcserélődnek 90° forgatás után
      photoWidth = originalHeight;
      photoHeight = originalWidth;
      
      console.log(`✅ After rotation: ${photoWidth}x${photoHeight} (PORTRAIT)`);
    } else {
      // PORTRAIT → Nincs forgatás
      console.log(`✅ Photo is already PORTRAIT (${originalWidth}x${originalHeight}) - no rotation needed`);
      rotatedSrcMat = srcMat;
      photoWidth = originalWidth;
      photoHeight = originalHeight;
    }

    console.log('📸 Final photo dimensions:', photoWidth, 'x', photoHeight);

    // === TESZT MÓD: Downscale to 12MP (iPhone 12 szimuláció) ===
    const TEST_MODE_12MP = false; // TESZT: állítsd false-ra az éles verzióhoz
    const TARGET_12MP = 12_000_000; // 12 megapixel
    
    if (TEST_MODE_12MP && photoWidth * photoHeight > TARGET_12MP) {
      const currentPixels = photoWidth * photoHeight;
      const scaleFactor = Math.sqrt(TARGET_12MP / currentPixels);
      const newWidth = Math.round(photoWidth * scaleFactor);
      const newHeight = Math.round(photoHeight * scaleFactor);
      
      console.log(`🔽 TESZT: Downscaling from ${photoWidth}x${photoHeight} (${(currentPixels/1_000_000).toFixed(1)}MP) to ${newWidth}x${newHeight} (${((newWidth*newHeight)/1_000_000).toFixed(1)}MP)`);
      
      const downscaledMat = OpenCV.createObject(ObjectType.Mat, newHeight, newWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('resize', rotatedSrcMat, downscaledMat, createSize(newWidth, newHeight), 0, 0, 2); // INTER_CUBIC
      
      rotatedSrcMat = downscaledMat;
      photoWidth = newWidth;
      photoHeight = newHeight;
      
      console.log('✅ TESZT: Downscale to 12MP completed');
    }

    if (photoWidth === 0 || photoHeight === 0) {
      try {
        const sizeResult = (srcMat as any).size?.() ?? null;
        if (sizeResult && sizeResult.width && sizeResult.height) {
          photoWidth = sizeResult.width;
          photoHeight = sizeResult.height;
        }
      } catch (e) {
        // Ignore
      }

      if (photoWidth === 0 || photoHeight === 0) {
        photoWidth = (srcMat as any).cols ?? (srcMat as any).width ?? 0;
        photoHeight = (srcMat as any).rows ?? (srcMat as any).height ?? 0;
      }

      if (photoWidth === 0 || photoHeight === 0) {
        photoWidth = 3264;
        photoHeight = 2448;
        console.warn(
          '⚠️ Could not detect photo dimensions, using fallback:',
          photoWidth,
          'x',
          photoHeight,
        );
      }
    } else {
      console.log('✅ Using provided photo dimensions from Image.getSize');
    }

    console.log('📸 Photo dimensions:', {
      photoWidth,
      photoHeight,
      photoAspect:
        photoWidth > 0 ? (photoHeight / photoWidth).toFixed(2) : 'N/A',
    });

    // === FRAME CORNERS - MÁR A FRAME NATÍV FELBONTÁSÁBAN VANNAK! ===
    // A frameCorners és processedCorners UGYANAZOK - már a useInferenceLogic felskálázta őket
    // a frame NATÍV felbontására (pl. 1280x720)
    // Most skálázni kell a FOTÓ felbontására!
    
    const frameNativeWidth = (providedFrameWidth ?? 1280);
    const frameNativeHeight = (providedFrameHeight ?? 720);
    
    // Photo dimensions (no rotation needed)
    const photoNativeWidth = photoWidth;
    const photoNativeHeight = photoHeight;
    
    // Skálázási arányok - FRAME NATÍV → PHOTO
    const scaleX = photoNativeWidth / frameNativeWidth;
    const scaleY = photoNativeHeight / frameNativeHeight;
    
    const scaledFrameCorners = frameCorners.map(fc => ({
      x: fc.x * scaleX,
      y: fc.y * scaleY,
    }));
    
    console.log('📐 Scaled frame corners to photo resolution:', {
      frameNative: `${frameNativeWidth}x${frameNativeHeight}`,
      photoNative: `${photoNativeWidth}x${photoNativeHeight}`,
      scaleX: scaleX.toFixed(2),
      scaleY: scaleY.toFixed(2),
      frameCorner0: frameCorners[0],
      scaledCorner0: scaledFrameCorners[0],
    });

    // === STEP IMAGES - Debug képek tárolása ===
    const stepImages: { label: string; image: string }[] = [];

    // === NAGY FOTÓ DETEKTÁLÁS - Újrafuttatjuk a detektálást a teljes felbontású képen ===
    console.log('🔍 Re-detecting corners on full resolution photo...');
    
    // FÉNYERŐ BEÁLLÍTÁSOK - Többféle brightness beállítással próbálkozunk
    // Ha az egyik nem működik, próbáljuk a másikat
    const brightnessSettings = [
      { alpha: 1.0, beta: 10, name: 'normal' },
      { alpha: 1.3, beta: 30, name: 'bright' },
      { alpha: 1.5, beta: 50, name: 'very-bright' },
      { alpha: 0.8, beta: -20, name: 'dark' },
    ];
    
    let photoDetectionResult: any = null;
    let usedSettings: { alpha: number; beta: number; name: string } | null = null;
    
    for (const settings of brightnessSettings) {
      console.log(`🔍 Trying photo detection with ${settings.name} (alpha=${settings.alpha}, beta=${settings.beta})...`);
      
      const result = detectDocumentCorners({
        mat: rotatedSrcMat,
        width: photoWidth,
        height: photoHeight,
        alpha: settings.alpha,
        beta: settings.beta,
        enableDebugImages: enableDebugImages,
      });
      
      if (result.corners && result.corners.length === 4) {
        console.log(`✅ Photo detection succeeded with ${settings.name} settings!`);
        photoDetectionResult = result;
        usedSettings = settings;
        break;
      }
    }
    
    // Ha egyik sem működött, használjuk az utolsó eredményt (debug céljából)
    if (!photoDetectionResult) {
      console.log('❌ All brightness settings failed');
      photoDetectionResult = detectDocumentCorners({
        mat: rotatedSrcMat,
        width: photoWidth,
        height: photoHeight,
        alpha: 1.0,
        beta: 10,
        enableDebugImages: enableDebugImages,
      });
    }

    console.log('📊 Photo detection result:', {
      found: photoDetectionResult.corners !== null,
      confidence: photoDetectionResult.confidence,
      debugInfo: photoDetectionResult.debugInfo,
      usedSettings: usedSettings?.name || 'none',
      hasDebugImage: !!photoDetectionResult.debugImage,
    });

    // === DEBUG IMAGE 0.2 - Downscaled image (720x1280) used for detection ===
    if (photoDetectionResult.debugImage) {
      stepImages.push({
        label: '0.2. Downscaled image (720x1280) - detection input',
        image: photoDetectionResult.debugImage,
      });
      console.log('✅ Debug 0.3: Downscaled image saved');
    }
    
    // === DEBUG KÉPEK - Detection lépések ===
    if (photoDetectionResult.debugGray) {
      stepImages.push({ label: '0.3. Grayscale', image: photoDetectionResult.debugGray });
    }
    if (photoDetectionResult.debugBrightened) {
      stepImages.push({ label: '0.4. Brightness adjusted', image: photoDetectionResult.debugBrightened });
    }
    if (photoDetectionResult.debugAdaptive) {
      stepImages.push({ label: '0.5. Adaptive threshold', image: photoDetectionResult.debugAdaptive });
    }
    if (photoDetectionResult.debugBinary) {
      stepImages.push({ label: '0.6. Binary threshold', image: photoDetectionResult.debugBinary });
    }
    if (photoDetectionResult.debugBlurred) {
      stepImages.push({ label: '0.7. Gaussian blur', image: photoDetectionResult.debugBlurred });
    }
    if (photoDetectionResult.debugMorph) {
      stepImages.push({ label: '0.8. Morphology (closing)', image: photoDetectionResult.debugMorph });
    }
    if (photoDetectionResult.debugCanny) {
      stepImages.push({ label: '0.9. Canny edges', image: photoDetectionResult.debugCanny });
    }
    if (photoDetectionResult.debugCombined) {
      stepImages.push({ label: '0.10. Combined edges', image: photoDetectionResult.debugCombined });
    }
    if (photoDetectionResult.debugContours) {
      stepImages.push({ label: '0.11. All contours (green)', image: photoDetectionResult.debugContours });
    }

    // === DEBUG KÉP - Rajzoljuk rá a detektált photo edge-eket ===
    try {
      const debugMat = OpenCV.createObject(
        ObjectType.Mat,
        photoHeight,
        photoWidth,
        DataTypes.CV_8UC3,
      );
      OpenCV.invoke('cvtColor', rotatedSrcMat, debugMat, ColorConversionCodes.COLOR_BGR2RGB);

      // Csak a photo detection eredményét rajzoljuk (zöld)
      if (photoDetectionResult.corners && photoDetectionResult.corners.length === 4) {
        console.log('🎨 Drawing detected photo corners (green) on debug image');
        
        // Rajzoljuk meg a detektált contour vonalakat (zöld)
        const corners = photoDetectionResult.corners;
        for (let i = 0; i < 4; i++) {
          const p1 = corners[i];
          const p2 = corners[(i + 1) % 4];
          
          const point1 = OpenCV.createObject(ObjectType.Point, Math.round(p1.x), Math.round(p1.y));
          const point2 = OpenCV.createObject(ObjectType.Point, Math.round(p2.x), Math.round(p2.y));
          const greenScalar = OpenCV.createObject(ObjectType.Scalar, 0, 255, 0, 255); // Zöld
          
          OpenCV.invoke('line', debugMat, point1, point2, greenScalar, 15, 8); // 8 = LINE_8
        }
        
        // Rajzoljuk meg a photo sarkokat (zöld körök)
        for (const corner of corners) {
          const point = OpenCV.createObject(ObjectType.Point, Math.round(corner.x), Math.round(corner.y));
          const greenCircleScalar = OpenCV.createObject(ObjectType.Scalar, 0, 255, 0, 255); // Zöld
          
          OpenCV.invoke('circle', debugMat, point, 30, greenCircleScalar, -1, 8); // -1 = filled, 8 = LINE_8
        }
      } else {
        console.log('❌ No photo corners detected');
      }

      const debugResult = OpenCV.toJSValue(debugMat);
      if (debugResult?.base64) {
        stepImages.push({
          label: '0.12. Photo edges (green=detected document)',
          image: debugResult.base64,
        });
      }
    } catch (debugError) {
      console.error('Failed to create photo detection debug image:', debugError);
    }

    // MOZGÁS/DRIFT DETEKTÁLÁS - Frame vs Fotó cornerek összehasonlítása
    let movementDetected = false;
    let maxMovement = 0;
    
    if (photoDetectionResult.corners) {
      const movements = photoDetectionResult.corners.map((pc, i) => {
        const fc = scaledFrameCorners[i];
        const dx = pc.x - fc.x;
        const dy = pc.y - fc.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance;
      });
      
      maxMovement = Math.max(...movements);
      movementDetected = maxMovement > 50; // 50 pixel threshold
      
      console.log('📏 Frame vs Photo corner movement:', {
        maxMovement: maxMovement.toFixed(1),
        movements: movements.map(m => m.toFixed(1)),
        movementDetected,
      });
    }

    // Válasszuk ki a legjobb sarokpontokat
    let corners: DocumentCorner[];
    let cornerSource: string; // Leírja hogy honnan származnak a használt sarkok
    let edgeCorrectionDebug = 'No contour data available';
    
    if (photoDetectionResult.corners) {
      // Fotó detektálás sikeres - MINDIG ezt használjuk (nincs mozgás ellenőrzés, nincs átlagolás)
      console.log('✅ Using photo-detected corners');
      corners = photoDetectionResult.corners;
      cornerSource = 'photo';

      // Apply midpoint-based edge correction if contour data is available
      if (photoDetectionResult.contourPoints && photoDetectionResult.contourPoints.length > 0) {
        const correction = correctCornersWithMidpoints(corners, photoDetectionResult.contourPoints);
        corners = correction.corners;
        edgeCorrectionDebug = correction.debugInfo;
        console.log('✅ Applied 8-point edge correction');
      }
    } else {
      // Photo detection failed - RETURNING ERROR!
      // We cannot use frame corners because user might have moved during the shot!
      console.warn('❌ Photo detection failed - ABORTING scan process');
      return {
        success: false,
        error: 'Failed to detect document in photo. Please try again!',
        stepImages: enableDebugImages ? stepImages : [],
      };
    }

    console.log('✂️ Starting perspective transform with selected corners');

    const leftEdge = Math.hypot(
      corners[1].x - corners[0].x,
      corners[1].y - corners[0].y,
    );
    const rightEdge = Math.hypot(
      corners[2].x - corners[3].x,
      corners[2].y - corners[3].y,
    );
    const topEdge = Math.hypot(
      corners[3].x - corners[0].x,
      corners[3].y - corners[0].y,
    );
    const bottomEdge = Math.hypot(
      corners[2].x - corners[1].x,
      corners[2].y - corners[1].y,
    );

    const detectedHeight = Math.round((leftEdge + rightEdge) / 2);
    const detectedWidth = Math.round((topEdge + bottomEdge) / 2);
    
    // Use fixed high-resolution output size for best quality
    // This ensures consistent output regardless of detection size
    let width = TARGET_OUTPUT_WIDTH;
    let height = TARGET_OUTPUT_HEIGHT;
    
    console.log(`📐 Using fixed output resolution: ${width}x${height} (detected: ${detectedWidth}x${detectedHeight})`);

    // Apply inward nudge to all corners to eliminate black border artifacts.
    // Each corner is shifted slightly toward the document center.
    const INWARD_NUDGE_PERCENT = 0; // 0.5% of edge length
    const nudgeCenter: DocumentCorner = {
      x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
      y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
    };
    const nudgedCorners = corners.map(c => {
      const dx = nudgeCenter.x - c.x;
      const dy = nudgeCenter.y - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) return c;
      const nudgeAmount = dist * INWARD_NUDGE_PERCENT;
      return {
        x: c.x + (dx / dist) * nudgeAmount,
        y: c.y + (dy / dist) * nudgeAmount,
      };
    });

    console.log(`📐 Applied ${INWARD_NUDGE_PERCENT * 100}% inward nudge to corners`);

    // Collect all edge correction debug info
    let fullEdgeCorrectionInfo = [
      `=== ORIGINAL CORNERS ===`,
      `TL: (${photoDetectionResult.corners[0].x}, ${photoDetectionResult.corners[0].y})`,
      `TR: (${photoDetectionResult.corners[1].x}, ${photoDetectionResult.corners[1].y})`,
      `BR: (${photoDetectionResult.corners[2].x}, ${photoDetectionResult.corners[2].y})`,
      `BL: (${photoDetectionResult.corners[3].x}, ${photoDetectionResult.corners[3].y})`,
      ``,
      `=== MIDPOINT CORRECTION ===`,
      edgeCorrectionDebug,
      ``,
      `=== AFTER CORRECTION ===`,
      `TL: (${corners[0].x}, ${corners[0].y})`,
      `TR: (${corners[1].x}, ${corners[1].y})`,
      `BR: (${corners[2].x}, ${corners[2].y})`,
      `BL: (${corners[3].x}, ${corners[3].y})`,
      ``,
      `=== NUDGE ===`,
      `Nudge: ${INWARD_NUDGE_PERCENT * 100}%`,
      `Final TL: (${nudgedCorners[0].x.toFixed(1)}, ${nudgedCorners[0].y.toFixed(1)})`,
      `Final TR: (${nudgedCorners[1].x.toFixed(1)}, ${nudgedCorners[1].y.toFixed(1)})`,
      `Final BR: (${nudgedCorners[2].x.toFixed(1)}, ${nudgedCorners[2].y.toFixed(1)})`,
      `Final BL: (${nudgedCorners[3].x.toFixed(1)}, ${nudgedCorners[3].y.toFixed(1)})`,
      ``,
      `Detected size: ${detectedWidth}x${detectedHeight}`,
      `Output size: ${width}x${height}`,
    ].join('\n');

    const srcPoints = OpenCV.createObject(ObjectType.Point2fVector, [
      createPoint2f(nudgedCorners[0].x, nudgedCorners[0].y),
      createPoint2f(nudgedCorners[1].x, nudgedCorners[1].y),
      createPoint2f(nudgedCorners[2].x, nudgedCorners[2].y),
      createPoint2f(nudgedCorners[3].x, nudgedCorners[3].y),
    ]);

    const dstPoints = OpenCV.createObject(ObjectType.Point2fVector, [
      createPoint2f(0, 0),
      createPoint2f(width, 0),
      createPoint2f(width, height),
      createPoint2f(0, height),
    ]);

    const M = OpenCV.invoke('getPerspectiveTransform', srcPoints, dstPoints, 0);
    const dstMat = createMat(height, width, DataTypes.CV_8UC3);
    const dstSize = createSize(width, height);
    const borderValue = OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0); // BLACK border (detected post-warp)

    OpenCV.invoke(
      'warpPerspective',
      rotatedSrcMat,
      dstMat,
      M,
      dstSize,
      1,
      0,
      borderValue,
    );
    console.log('✅ Perspective transform completed');

    const stableDstMat = OpenCV.invoke('clone', dstMat);

    const flippedMat = createMat(height, width, DataTypes.CV_8UC3);
    OpenCV.invoke('flip', stableDstMat, flippedMat, 1);

    const rotatedMat = createMat(height, width, DataTypes.CV_8UC3);
    OpenCV.invoke('rotate', flippedMat, rotatedMat, 2);

    const stableRotatedMat = OpenCV.invoke('clone', rotatedMat);

    const scaledHeight = Math.round(height * SCALE_FACTOR);
    const scaledWidth = Math.round(width * SCALE_FACTOR);
    const scaledMat = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'resize',
      stableRotatedMat,
      scaledMat,
      createSize(scaledWidth, scaledHeight),
      0,
      0,
      2,
    );

    const cropLeft = Math.round(scaledWidth * CROP_PERCENT);
    const cropTop = Math.round(scaledHeight * CROP_PERCENT);
    const cropWidth = scaledWidth - 2 * cropLeft;
    const cropHeight = scaledHeight - 2 * cropTop;

    const cropRect = OpenCV.createObject(
      ObjectType.Rect,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
    );

    const croppedMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('crop', scaledMat, croppedMat, cropRect);

    // Step 0: Original photo (no rotation)
    const step0Result = OpenCV.toJSValue(rotatedSrcMat);
    if (step0Result?.base64) {
      stepImages.push({ label: '0.13. Original photo (original orientation)', image: step0Result.base64 });
    }

    // === BLUR DETECTION - Laplacian variance ===
    /* // FONTOS: A FELSŐ HARMADRA külön nézünk, mert ferde fotónál ott homályos!
    console.log('🔍 Detecting blur in cropped image (focusing on TOP THIRD)...');
    
    // Convert to grayscale for blur detection
    const grayForBlur = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('cvtColor', croppedMat, grayForBlur, 6, 0); // COLOR_BGR2GRAY = 6
    
    // === FELSŐ HARMAD blur detektálás ===
    // Ez a legfontosabb rész - ferde fotónál a teteje homályos!
    const topThirdHeight = Math.round(cropHeight / 3);
    const topThirdRect = OpenCV.createObject(ObjectType.Rect, 0, 0, cropWidth, topThirdHeight);
    const grayTopThird = OpenCV.createObject(ObjectType.Mat, topThirdHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('crop', grayForBlur, grayTopThird, topThirdRect);
    
    // Laplacian a felső harmadra
    const laplacianTop = OpenCV.createObject(ObjectType.Mat, topThirdHeight, cropWidth, DataTypes.CV_16S);
    OpenCV.invoke('Laplacian', grayTopThird, laplacianTop, DataTypes.CV_16S, 3, 1, 0, 4);
    
    const absLaplacianTop = OpenCV.createObject(ObjectType.Mat, topThirdHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('convertScaleAbs', laplacianTop, absLaplacianTop);
    
    const meanScalarTop = OpenCV.invoke('mean', absLaplacianTop);
    const meanDataTop = OpenCV.toJSValue(meanScalarTop);
    const topBlurScore = meanDataTop?.a || meanDataTop?.[0] || 0;
    
    // === TELJES KÉP blur (referenciaként) ===
    const laplacian = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_16S);
    OpenCV.invoke('Laplacian', grayForBlur, laplacian, DataTypes.CV_16S, 3, 1, 0, 4);
    
    const absLaplacian = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('convertScaleAbs', laplacian, absLaplacian);
    
    const blurMinMaxResult = OpenCV.invoke('minMaxLoc', absLaplacian);
    const blurMaxVal = blurMinMaxResult.maxVal || 0;
    
    const meanScalar = OpenCV.invoke('mean', absLaplacian);
    const meanData = OpenCV.toJSValue(meanScalar);
    const fullBlurScore = meanData?.a || meanData?.[0] || 0;
    
    // A MINIMUM a kettő közül - ha a teteje homályos, az a döntő!
    const blurScore = Math.min(topBlurScore, fullBlurScore);
    
    console.log(`📊 Blur detection: TOP=${topBlurScore.toFixed(2)}, FULL=${fullBlurScore.toFixed(2)}, FINAL=${blurScore.toFixed(2)} (${blurScore < 8 ? 'BLURRY' : blurScore < 12 ? 'MODERATE' : 'SHARP'})`);

    // STRICT BLUR CHECK - Ha a felső harmad homályos, dobjuk vissza!
    if (blurScore < 6) {
      console.error(`❌ Image too blurry (top third): ${blurScore.toFixed(2)} < 8 - ABORTING scan`);
      return {
        success: false,
        error: `Kép teteje homályos (${blurScore.toFixed(1)}). Tartsd szemben a kamerát!`,
        stepImages: enableDebugImages ? stepImages : [],
      };
    } */

    // Step 1: Original cropped image (NO blur applied, just detection)
    const step1Result = OpenCV.toJSValue(croppedMat);
    if (step1Result?.base64) {
      stepImages.push({ 
        label: `1. Cropped image`,
        image: step1Result.base64 
      });
    }

    // === COLOR MASK DETECTION - Detektáljuk a színes területeket ===
    console.log('🎨 Detecting VIBRANT colored regions for preservation');
    console.log('⚙️ Mask config:', {
      blackMaskAdaptiveC: cfg.blackMaskAdaptiveC,
      darkInkC_iOS: cfg.darkInkC_iOS,
      darkInkC_Android: cfg.darkInkC_Android,
      darkInkAbsoluteDarkMax: cfg.darkInkAbsoluteDarkMax,
      colorSatExcess: cfg.colorMaskSatExcessThreshold,
      colorGlobalSatMin: cfg.colorMaskGlobalSatMin,
      colorBrightMin: cfg.colorMaskBrightMin,
      colorWhiteMax: cfg.colorMaskWhiteMax,
    });
    
    // Split channels to detect color variance
    const bChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    const gChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    const rChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    
    // Extract channels (OpenCV uses BGR order)
    OpenCV.invoke('extractChannel', croppedMat, bChannel, 0); // Blue
    OpenCV.invoke('extractChannel', croppedMat, gChannel, 1); // Green
    OpenCV.invoke('extractChannel', croppedMat, rChannel, 2); // Red
    
    // Calculate max and min channels to find saturation-like metric
    const maxChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    const minChannel = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    
    OpenCV.invoke('max', bChannel, gChannel, maxChannel);
    OpenCV.invoke('max', maxChannel, rChannel, maxChannel); // max = max(R,G,B)
    
    OpenCV.invoke('min', bChannel, gChannel, minChannel);
    OpenCV.invoke('min', minChannel, rChannel, minChannel); // min = min(R,G,B)
    
    // Saturation approximation: (max - min)
    const saturation = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('subtract', maxChannel, minChannel, saturation);
    
    // Color detection: LOCAL EXCESS saturation approach
    // Why? Flash creates uniform color cast (yellowish/bluish) across entire paper.
    // Global threshold picks up entire background as "colored".
    // Solution: blur saturation → local average, subtract from original → excess above neighbors
    // Only pixels that are LOCALLY more saturated (ink) survive, uniform flash cast → 0
    
    // 1. Blur saturation → approximates local mean
    const satBlurred = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    const satBlurKsize = OpenCV.invoke('getStructuringElement', 0, createSize(cfg.colorMaskLocalBlurSize, cfg.colorMaskLocalBlurSize)); // just for size
    OpenCV.invoke('GaussianBlur', saturation, satBlurred, createSize(cfg.colorMaskLocalBlurSize, cfg.colorMaskLocalBlurSize), 0, 0, 4);
    
    // 2. Local excess: sat - blurred (clamped to 0 by OpenCV subtract on uint8)
    const satExcess = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('subtract', saturation, satBlurred, satExcess);
    
    // 3. Threshold the excess: must be X+ above local average to count as colored
    const colorMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', satExcess, colorMask, cfg.colorMaskSatExcessThreshold, 255, 0); // THRESH_BINARY
    
    // Also keep a global minimum: saturation must be at least X to avoid noise
    const globalSatMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', saturation, globalSatMask, cfg.colorMaskGlobalSatMin, 255, 0); // THRESH_BINARY
    OpenCV.invoke('bitwise_and', colorMask, globalSatMask, colorMask);
    
    // Global direct saturation: pixels with very high absolute saturation are ALWAYS colored
    // This preserves large uniformly-colored areas (stickers, logos, stamps) where local excess fails
    if (cfg.colorMaskGlobalSatDirect > 0) {
      const globalDirectMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
      OpenCV.invoke('threshold', saturation, globalDirectMask, cfg.colorMaskGlobalSatDirect, 255, 0); // THRESH_BINARY
      OpenCV.invoke('bitwise_or', colorMask, globalDirectMask, colorMask); // OR: either local excess OR high global sat
      console.log('🎯 Global direct saturation threshold:', cfg.colorMaskGlobalSatDirect);
    }
    
    const brightThreshold = cfg.colorMaskBrightMin;
    
    // Minimum brightness filter - túl sötét pixelek nem számítanak (árnyékok)
    const brightMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', maxChannel, brightMask, brightThreshold, 255, 0);
    
    // Maximum brightness filter - túl világos pixelek (fehér papír, flash tükröződés) nem számítanak
    // FONTOS: minChannel-t használjuk, nem maxChannel-t! Piros tintánál maxChannel (R) lehet 250+,
    // de az nem "fehér" — igazi fehér pixelnél MINDEN csatorna magas (min > whiteMax)
    const notTooWhiteMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', minChannel, notTooWhiteMask, cfg.colorMaskWhiteMax, 255, 1); // THRESH_BINARY_INV = 1, min < whiteMax → not white
    
    // Combine saturation + brightness + not-too-white filters
    const colorMaskFiltered = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', colorMask, brightMask, colorMaskFiltered);
    OpenCV.invoke('bitwise_and', colorMaskFiltered, notTooWhiteMask, colorMaskFiltered);
    
    // Dilate mask to include color edges without thickening text
    const dilateKernel = OpenCV.invoke('getStructuringElement', 2, createSize(1, 1)); // MORPH_ELLIPSE = 2
    const colorMaskDilated = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', colorMaskFiltered, colorMaskDilated, 1, dilateKernel); // MORPH_DILATE = 1
    
    // Store original colored regions
    const coloredRegions = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', croppedMat, croppedMat, coloredRegions, colorMaskDilated);
    
    console.log('✅ Color mask created - saturation>50, brightness 60-250, dilate 9x9');

    // Step 1.5: Color mask visualization
    const colorMaskBGR = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('cvtColor', colorMaskDilated, colorMaskBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step1_5Result = OpenCV.toJSValue(colorMaskBGR);
    if (step1_5Result?.base64) {
      stepImages.push({ label: '2. Color mask (saturation)', image: step1_5Result.base64 });
    }

    // === DARK INK MASK - Fekete tinta megőrzése (sima vonalak a threshold szaggatás helyett) ===
    console.log('�️ Detecting dark ink regions for smooth preservation');
    
    // Adaptive threshold a maxChannel-en: lokálisan nézi mi sötét → flash hotspot, árnyék nem zavar
    const darkInkTotalPixels = cropWidth * cropHeight;
    const darkInkHighRes = darkInkTotalPixels > 3_000_000;
    const darkInkBlockSize = darkInkHighRes ? cfg.blackMaskBlockSizeHighRes : cfg.blackMaskBlockSizeLowRes;
    const darkInkC = darkInkHighRes
      ? (Platform.OS === 'android' ? cfg.darkInkC_Android : cfg.darkInkC_iOS)
      : (Platform.OS === 'android' ? cfg.darkInkCLowRes_Android : cfg.darkInkCLowRes_iOS); // iOS highRes 18: notebook dots (~15 contrast) filtered, real ink (30+) kept
    const darkInkBrightMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    // ADAPTIVE_THRESH_GAUSSIAN_C = 1, THRESH_BINARY_INV = 1 (sötétebb mint környezete → white)
    OpenCV.invoke('adaptiveThreshold', maxChannel, darkInkBrightMask, 140, 1, 1, darkInkBlockSize, darkInkC);
    
    const lowSatMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', saturation, lowSatMask, cfg.darkInkLowSatMax, 255, 1); // THRESH_BINARY_INV = 1, sat < threshold → nem színes
    
    // Abszolút fényerő szűrő: sötét pixelek (maxChannel < darkInkAbsoluteDarkMax)
    const absoluteDarkMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', maxChannel, absoluteDarkMask, cfg.darkInkAbsoluteDarkMax, 255, 1); // THRESH_BINARY_INV = 1

    // Combine: lokálisan sötét ÉS abszolút sötét ÉS nem színes = fekete tinta
    const darkInkMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', darkInkBrightMask, lowSatMask, darkInkMask);
    OpenCV.invoke('bitwise_and', darkInkMask, absoluteDarkMask, darkInkMask);
    
    // Morphological opening: remove small isolated dots (notebook dots ~5-8px on high-res)
    // while keeping continuous ink strokes. Erode kills dots, dilate restores stroke edges.
    const openKernelSize = darkInkHighRes ? cfg.darkInkOpenKernelHighRes : cfg.darkInkOpenKernelLowRes;
    const openKernel = OpenCV.invoke('getStructuringElement', 2, createSize(openKernelSize, openKernelSize)); // MORPH_ELLIPSE
    OpenCV.invoke('morphologyEx', darkInkMask, darkInkMask, 2, openKernel); // MORPH_OPEN = 2
    
    // Exclude pixels that are already in the color mask (ne legyen dupla maszkolás)
    const notColorMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', colorMaskDilated, notColorMask);
    OpenCV.invoke('bitwise_and', darkInkMask, notColorMask, darkInkMask);
    
    // Dilate to cover ink edges (3x3 ellipse — minimal to avoid thickening)
    const darkInkDilateKernel = OpenCV.invoke('getStructuringElement', 2, createSize(3, 3)); // MORPH_ELLIPSE = 2
    const darkInkMaskDilated = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', darkInkMask, darkInkMaskDilated, 1, darkInkDilateKernel); // MORPH_DILATE = 1
    
    // Re-exclude color regions AFTER dilate — dilated dark ink must not bleed into color areas
    OpenCV.invoke('bitwise_and', darkInkMaskDilated, notColorMask, darkInkMaskDilated);
    
    console.log('✅ Dark ink mask created - adaptive blockSize:', darkInkBlockSize, 'C:', darkInkC);

    // Step 1.6: Dark ink mask visualization
    if (enableDebugImages) {
      const darkInkMaskBGR = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', darkInkMaskDilated, darkInkMaskBGR, 8, 0); // COLOR_GRAY2BGR = 8
      const step1_6Result = OpenCV.toJSValue(darkInkMaskBGR);
      if (step1_6Result?.base64) {
        stepImages.push({ label: '2.5. Dark ink mask', image: step1_6Result.base64 });
      }
    }

    // === GRAYSCALE CONVERSION ===
    console.log('🎨 Converting to grayscale');
    const grayMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('cvtColor', croppedMat, grayMat, 6, 0); // COLOR_BGR2GRAY = 6

    // === BRIGHTNESS DETECTION using mean ===
    console.log('💡 Detecting image brightness with mean');
    const meanResult = OpenCV.invoke('mean', grayMat);
    const meanData = OpenCV.toJSValue(meanResult);
    const avgBrightness = Math.round(meanData.a);

    console.log('📊 Brightness analysis:', {
      avgBrightness,
    });

    const betaBoost = 0;

    const lightCondition: 'Daylight' | 'Normal' | 'Night' =
      avgBrightness > 180
        ? 'Daylight'
        : avgBrightness > 120
        ? 'Normal'
        : 'Night';

    console.log('💡 Brightness detection:', {
      avgBrightness: avgBrightness.toFixed(1),
      lightCondition,
    });

    // === OVEREXPOSURE DETECTION ===
    // Ha a kép túl világos (túlexponált), a vonalak eltűnnek → retry
    if (avgBrightness > 230) {
      console.warn(`⚠️ Overexposed image detected (brightness: ${avgBrightness.toFixed(1)}) - requesting retry`);
      return {
        success: false,
        error: 'Overexposed photo - retrying',
        imageBase64: '',
        stepImages: [],
        qrValue: currentQrValue,
        qrPosition: currentQrPosition,
        brightnessInfo: { avgBrightness, lightCondition, betaBoost },
        selectedIcons: [],
        selectedIconNames: [],
        iconAnalysis: [],
      };
    }

    // Adaptive threshold handles flash hotspots locally - no global brightness adjustment needed
    console.log('📝 Using adaptiveThreshold for local binarization (flash-safe)');

    // Step 2: Grayscale
    const grayMatBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', grayMat, grayMatBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step2Result = OpenCV.toJSValue(grayMatBGR);
    if (step2Result?.base64) {
      stepImages.push({ 
        label: '3. Grayscale (raw)', 
        image: step2Result.base64 
      });
    }

    // Use raw grayscale for threshold
    const sharpenedGray = grayMat;

    // === BLACK MASK (ADAPTIVE THRESHOLD) ===
    // adaptiveThreshold works LOCALLY - each pixel's threshold is computed from its neighborhood
    // This naturally handles flash hotspots: bright center still has bright neighbors → stays white
    // While text is always darker than its local neighborhood → becomes black
    console.log('🎭 Creating adaptive threshold mask (flash-safe, local)');
    
    // Block size should scale with image resolution
    const totalPixels = cropWidth * cropHeight;
    const isHighRes = totalPixels > 3_000_000;
    // Larger block = more robust to noise, smaller block = more detail
    // Must be odd number
    const blockSize = isHighRes ? cfg.blackMaskBlockSizeHighRes : cfg.blackMaskBlockSizeLowRes;
    // C constant: pixel must be C levels DARKER than local mean to be black
    // Notebook dots are ~20-40 levels darker than paper → C=50 filters them out
    // Real ink/text is ~80-150 levels darker → easily passes C=50
    const adaptiveC = cfg.blackMaskAdaptiveC;
    
    console.log('📐 Adaptive threshold params:', {
      totalPixels,
      isHighRes,
      blockSize,
      adaptiveC,
      avgBrightness,
    });
    
    // Apply Gaussian adaptive threshold (better than mean for uneven lighting)
    const maskMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    // ADAPTIVE_THRESH_GAUSSIAN_C = 1, THRESH_BINARY = 0
    OpenCV.invoke('adaptiveThreshold', sharpenedGray, maskMat, 255, 1, 0, blockSize, adaptiveC);
    
    // === MIX: Burn dark ink mask into the threshold result ===
    // maskMat: white=background, black=text (from adaptiveThreshold)
    // darkInkMaskDilated: white=dark ink, black=everything else
    // Where dark ink is detected → force pixel to BLACK in maskMat (combine both detections)
    const invertedDarkInk = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', darkInkMaskDilated, invertedDarkInk); // dark ink areas become 0 (black)
    OpenCV.invoke('bitwise_and', maskMat, invertedDarkInk, maskMat); // force those pixels black in maskMat
    
    console.log('✅ Adaptive threshold + dark ink mask combined');

    // Step 4: Black mask (threshold)
    const maskMatBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', maskMat, maskMatBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step4Result = OpenCV.toJSValue(maskMatBGR);
    if (step4Result?.base64) {
      stepImages.push({ label: '5. Fekete maszk (threshold)', image: step4Result.base64 });
    }

    // === MORPHOLOGICAL OPENING - Remove noise (erosion then dilation) ===
    console.log('🧹 Removing noise with morphological opening');
    const kernel = OpenCV.invoke('getStructuringElement', 0, createSize(3, 3)); // MORPH_RECT = 0, 3x3 kernel (removes small dots)
    const openedMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    // Morphological opening: erode then dilate - removes noise
    OpenCV.invoke('morphologyEx', maskMat, openedMat, 2, kernel); // MORPH_OPEN = 2 (direkt maskMat-ból!)
    console.log('✅ Noise removal completed');

    // Step 5: Noise removed (morphological opening)
    const openedMatBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', openedMat, openedMatBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step5Result = OpenCV.toJSValue(openedMatBGR);
    if (step5Result?.base64) {
      stepImages.push({ label: '6. Noise removal (opening)', image: step5Result.base64 });
    }

    // === MORPHOLOGICAL CLOSING - Fill holes in text ===
    console.log('🔗 Applying morphological closing to fill holes in text');
    
    // FONTOS: A text FEKETE (0), háttér FEHÉR (255) after threshold
    // Closing csak FEHÉR objektumokra működik, ezért INVERTÁLNI kell!
    const invertedForClosing = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('bitwise_not', openedMat, invertedForClosing); // Text lesz FEHÉR
    
    const closingKernel = OpenCV.invoke('getStructuringElement', 2, createSize(2, 2)); // MORPH_ELLIPSE = 2, 2x2 kernel
    const closedInverted = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('morphologyEx', invertedForClosing, closedInverted, 3, closingKernel); // MORPH_CLOSE = 3
    
    // Invert back - text FEKETE again
    const closedMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('bitwise_not', closedInverted, closedMat);
    
    console.log('✅ Morphological closing completed - holes filled');

    // Step 5.5: After closing
    const closedMatBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', closedMat, closedMatBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step5_5Result = OpenCV.toJSValue(closedMatBGR);
    if (step5_5Result?.base64) {
      stepImages.push({ label: '6.5. Hole filling (closing)', image: step5_5Result.base64 });
    }

    // === PENCIL THICKENING - Make text/writing thicker ===
    console.log('✏️ Thickening text/writing for better visibility');
    
    // IMPORTANT: Invert the mask first! After threshold, text is FEKETE (0) on FEHÉR (255) background
    // We need WHITE text on BLACK background for dilate to thicken the text
    const invertedMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('bitwise_not', closedMat, invertedMat);
    
    // Create ellipse kernel for thickening (3x3 for moderate thickening)
    const thickenKernel = OpenCV.invoke('getStructuringElement', 2, createSize(1, 1)); // MORPH_ELLIPSE = 2
    
    const thickenedMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    
    // Dilate operation to thicken the lines (now working on BLACK text)
    OpenCV.invoke('morphologyEx', invertedMat, thickenedMat, 1, thickenKernel); // MORPH_DILATE = 1
    
    // Invert back to get WHITE text on BLACK background
    const finalThickened = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('bitwise_not', thickenedMat, finalThickened);
    
    console.log('✅ Text thickening completed');

    // Step 6: Thickened text
    const thickenedMatBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', finalThickened, thickenedMatBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step6Result = OpenCV.toJSValue(thickenedMatBGR);
    if (step6Result?.base64) {
      stepImages.push({ label: '7. Text thickening (dilate)', image: step6Result.base64 });
    }

    // === MEDIAN BLUR - Remove dots/noise while preserving edges ===
    console.log('🎯 Applying stronger median blur to remove dots/noise');
    const medianFiltered = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    // Median blur with 5x5 kernel - dots already handled by threshold + opening
    // Smaller kernel preserves text edge sharpness better
    OpenCV.invoke('medianBlur', finalThickened, medianFiltered, 1);
    console.log('✅ Median blur completed');

    // Step 6.5: After median blur
    const medianMatBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', medianFiltered, medianMatBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step6_5Result = OpenCV.toJSValue(medianMatBGR);
    if (step6_5Result?.base64) {
      stepImages.push({ label: '8. Median blur (dot removal)', image: step6_5Result.base64 });
    }

    // === FINAL GAUSSIAN BLUR - DISABLED (median blur is enough) ===
    // console.log('🌫️ Applying final Gaussian blur for smooth edges');
    // const blurredFinal = OpenCV.createObject(
    //   ObjectType.Mat,
    //   cropHeight,
    //   cropWidth,
    //   DataTypes.CV_8UC1,
    // );
    // const blurKsize = OpenCV.createObject(ObjectType.Size, 3, 3);
    // OpenCV.invoke('GaussianBlur', medianFiltered, blurredFinal, blurKsize, 1, 1, 4);
    // console.log('✅ Final Gaussian blur completed');

    // === FINAL SHARPENING - DISABLED (causes text thickening) ===
    // Sharpening + binarization combo pumped up edges → thicker text
    // Median blur output is clean enough, just binarize directly

    // === FORCE PURE BLACK & WHITE - szürke → full fekete, világos → full fehér ===
    const binarizedFinal = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', medianFiltered, binarizedFinal, 128, 255, 0); // THRESH_BINARY: >128 → white, else black
    
    // === ERODE - Keskenyítés: fekete vonalak vékonyabbá válnak ===
    const erodeKernel = OpenCV.invoke('getStructuringElement', 2, createSize(3, 3)); // MORPH_ELLIPSE = 2
    const erodedFinal = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', binarizedFinal, erodedFinal, 3, erodeKernel); // MORPH_OPEN = 3 (erode then dilate - removes thin noise)
    // B&W képen erode = fehér terjed → fekete vonalak vékonyodnak
    // Invertált logika: threshold output white=paper, black=ink → erode fehéríti a széleket
    console.log('✅ Pure B&W + erode (thinner text)');

    if (enableDebugImages) {
      const binBGR = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', erodedFinal, binBGR, 8, 0);
      const binResult = OpenCV.toJSValue(binBGR);
      if (binResult?.base64) {
        stepImages.push({ label: '9. Pure B&W + erode', image: binResult.base64 });
      }
    }

    const blurredFinal = erodedFinal;

    // Convert back to BGR for consistency with rest of code
    const finalMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', blurredFinal, finalMat, 8, 0); // COLOR_GRAY2BGR = 8

    // === TEST: Bottom 5% with 7 column dividers + icon detection ===
    // Teljes szélesség: 12.5 cm, bal margó: 2 cm, jobb margó: 2 cm → hasznos: 8.5 cm
    // 2% padding from bottom to avoid curved notebook edge bleeding into detection
    const bottomPadding = Math.round(cropHeight * 0.01);
    const bottom5Height = Math.round(cropHeight * 0.05);
    const bottom5StartY = cropHeight - bottom5Height - bottomPadding;
    const marginLeft = Math.round(cropWidth * (2 / 12.5));   // 16%
    const marginRight = Math.round(cropWidth * (2 / 12.5));  // 16%
    const usableWidth = cropWidth - marginLeft - marginRight; // 68%
    const sliceWidth = Math.round(usableWidth / 7);
    
    // Kivágás: alsó 5% sáv (grayscale-ből az elemzéshez)
    const bottom5GrayRect = OpenCV.createObject(ObjectType.Rect, 0, bottom5StartY, cropWidth, bottom5Height);
    const bottom5Gray = OpenCV.createObject(ObjectType.Mat, bottom5Height, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('crop', grayMat, bottom5Gray, bottom5GrayRect);
    
    // 7 szelet elemzése: hány % sötét pixel van benne
    // Az ikonok körvonalai + rajzai ~2-5% sötét pixelt adnak önmagukban,
    // ha be van jelölve (X/satírozás), az 10%+ sötét pixelt jelent
    const DARK_THRESHOLD = 2; // 8% felett = aktív (bejelölve)
    const PIXEL_DARK_VALUE = 100; // 100 alatti pixel = sötét (csak az igazi fekete X vonalak)
    const iconNames = ['Nyíl', 'Gyémánt', 'Alma', 'Csengő', 'Lóhere', 'Csillag', 'Patkó'];
    const iconActive: boolean[] = [];
    const iconDarkPercents: number[] = [];
    
    for (let i = 0; i < 7; i++) {
      const sliceX = marginLeft + i * sliceWidth;
      const sliceW = Math.min(sliceWidth, cropWidth - sliceX);
      
      // Szelet kivágása
      const sliceRect = OpenCV.createObject(ObjectType.Rect, sliceX, 0, sliceW, bottom5Height);
      const sliceMat = OpenCV.createObject(ObjectType.Mat, bottom5Height, sliceW, DataTypes.CV_8UC1);
      OpenCV.invoke('crop', bottom5Gray, sliceMat, sliceRect);
      
      // Threshold: pixel < 128 → fehér (sötét pixelek), többi → fekete  
      const threshMat = OpenCV.createObject(ObjectType.Mat, bottom5Height, sliceW, DataTypes.CV_8UC1);
      OpenCV.invoke('threshold', sliceMat, threshMat, PIXEL_DARK_VALUE, 255, 1); // THRESH_BINARY_INV
      
      // mean() a threshold képen: 0 = nincs sötét pixel, 255 = minden sötét
      // mean/255*100 = sötét pixelek %-a
      const meanScalar = OpenCV.invoke('mean', threshMat);
      const meanData = OpenCV.toJSValue(meanScalar);
      const meanVal = meanData?.a ?? meanData?.[0] ?? 0;
      const darkPercent = (meanVal / 255) * 100;
      
      const isActive = darkPercent > DARK_THRESHOLD;
      iconActive.push(isActive);
      iconDarkPercents.push(Math.round(darkPercent * 10) / 10);
      
      console.log(`Slot ${i + 1}: ${darkPercent.toFixed(1)}% dark → ${isActive ? 'ACTIVE' : 'inactive'}`);
    }
    
    console.log('Icon results:', iconActive.map((a, i) => `${iconNames[i]}${a ? 'ON' : 'off'}`).join(' '));
    
    const detectedIcons = iconActive.map((a, i) => a ? i : -1).filter(i => i >= 0);
    const detectedIconNames = iconActive.reduce<string[]>((acc, a, i) => { if (a) acc.push(iconNames[i]); return acc; }, []);

    // === SMART CROP BOTTOM - Find square QR code at bottom ===
    console.log('✂️ Smart cropping bottom - searching for square QR code');
    
    // A QR kód négyzet alakú, fekete, a kép alján van fehér háttéren
    // Keresünk egy négyzet alakú sötét területet az alsó 25%-ban
    let qrEndY = cropHeight; // Default: no crop if detection fails
    let qrDetected = false;
    
    try {
      // Csak az alsó 15%-ot vizsgáljuk - a QR kód a legalsó részen van
      const searchHeight = Math.round(cropHeight * 0.15);
      const searchStartY = cropHeight - searchHeight;
      
      // ROI az alsó részhez
      const bottomRect = OpenCV.createObject(
        ObjectType.Rect,
        0,
        searchStartY,
        cropWidth,
        searchHeight,
      );
      
      const bottomMat = OpenCV.createObject(ObjectType.Mat, searchHeight, cropWidth, DataTypes.CV_8UC1);
      // Use original grayscale (grayMat) for QR detection - processed image may lose QR details
      OpenCV.invoke('crop', grayMat, bottomMat, bottomRect);
      
      // Threshold - invertálva, hogy a fekete QR kód fehér legyen (kontúr kereséshez)
      // Lower threshold (100) to better detect dark QR codes
      const threshMat = OpenCV.createObject(ObjectType.Mat, searchHeight, cropWidth, DataTypes.CV_8UC1);
      OpenCV.invoke('threshold', bottomMat, threshMat, 100, 255, 1); // THRESH_BINARY_INV = 1
      
      // Kontúrok keresése
      const contours = OpenCV.createObject(ObjectType.MatVector);
      OpenCV.invoke(
        'findContours',
        threshMat,
        contours,
        RetrievalModes.RETR_EXTERNAL,
        ContourApproximationModes.CHAIN_APPROX_SIMPLE,
      );
      
      const contoursData = OpenCV.toJSValue(contours);
      const contoursSize = contoursData?.array?.length || 0;
      console.log(`🔍 Found ${contoursSize} contours in bottom region`);
      
      // Keressük a legnagyobb négyzet alakú kontúrt
      let bestQrContour = null;
      let bestQrArea = 0;
      
      // Minimum QR méret: a kép szélességének 2%-a négyzet (smaller to catch small QR)
      const minQrSize = cropWidth * 0.02;
      const minQrArea = minQrSize * minQrSize;
      
      // Maximum QR méret: a kép szélességének 25%-a négyzet
      const maxQrSize = cropWidth * 0.25;
      const maxQrArea = maxQrSize * maxQrSize;
      
      for (let i = 0; i < contoursSize; i++) {
        const contour = OpenCV.copyObjectFromVector(contours, i);
        const boundingRect = OpenCV.invoke('boundingRect', contour);
        const rectData = OpenCV.toJSValue(boundingRect);
        
        if (rectData) {
          const { x, y, width: w, height: h } = rectData;
          const area = w * h;
          
          // Négyzet alakú? (aspect ratio 0.7 - 1.4 között)
          const aspectRatio = w / h;
          const isSquare = aspectRatio >= 0.7 && aspectRatio <= 1.4;
          
          // Bal VAGY jobb alsó sarokban van?
          const isLeftSide = x < cropWidth * 0.3;
          const isRightSide = (x + w) > cropWidth * 0.7;
          const isCorner = isLeftSide || isRightSide;
          
          // A QR kódnak az alsó 50%-ban kell lennie a keresési területen belül
          const isAtBottom = (y + h) > searchHeight * 0.5;
          
          // Megfelelő méretű?
          const isSizeOk = area >= minQrArea && area <= maxQrArea;
          
          // Log potential candidates for debugging
          if (isSizeOk && isSquare) {
            console.log(`📦 Contour ${i}: x=${x}, y=${y}, w=${w}, h=${h}, aspect=${aspectRatio.toFixed(2)}, isCorner=${isCorner}, isAtBottom=${isAtBottom}`);
          }
          
          // Accept if square AND correct size AND in corner AND at bottom AND larger than previous
          if (isSquare && isSizeOk && isCorner && isAtBottom && area > bestQrArea) {
            bestQrArea = area;
            bestQrContour = {
              x: x,
              y: y + searchStartY, // Visszakonvertálás teljes kép koordinátára
              width: w,
              height: h,
            };
          }
        }
      }
      
      if (bestQrContour) {
        // QR kód teteje = levágási pont
        qrEndY = bestQrContour.y;
        qrDetected = true;
        console.log(`✅ Found square QR code at Y=${qrEndY}, size=${bestQrContour.width}x${bestQrContour.height}`);
        
        // Debug alert showing QR detection result
       /*  Alert.alert(
          'QR Detektálva',
          `Érték: ${currentQrValue || 'nincs'}\nY=${qrEndY}, size=${bestQrContour.width}x${bestQrContour.height}`
        ); */
      } else {
        // QR kontúr nem találta → fallback: 90% (alsó 10% = ikonsor + QR)
        qrEndY = Math.round(cropHeight * 0.90);
        console.log('⚠️ QR contour not found, using fallback 90%');
      }
      
    } catch (qrError) {
      console.warn('⚠️ QR detection error:', qrError);
      qrEndY = Math.round(cropHeight * 0.90);
    }
    
    // Add margin above QR top - biztonsági margó a QR kód fölött
    const margin = Math.round(cropHeight * 0.01); // 1% margin
    
    // Ha találtunk QR kódot, akkor annak tetejéig tartjuk meg a képet
    // qrEndY = a QR kód TETEJE (y koordináta a kép tetejétől)
    // finalHeight = ennyi pixelt tartunk meg felülről
    let finalHeight: number;
    if (qrDetected) {
      // qrEndY a QR kód teteje, margin-t levonjuk
      finalHeight = qrEndY - margin; // Subtract margin to ensure QR is fully cropped
      // Minimum 88% marad, maximum 97% - ne vágjunk túl sokat
      finalHeight = Math.max(finalHeight, Math.round(cropHeight * 0.88));
      finalHeight = Math.min(finalHeight, Math.round(cropHeight * 0.97));
      console.log(`📐 QR top at Y=${qrEndY}, margin=${margin}, finalHeight=${finalHeight} (${((finalHeight/cropHeight)*100).toFixed(1)}%)`);
    } else {
      // Fallback 90%
      finalHeight = Math.round(cropHeight * 0.90);
    }
    
    console.log(`📐 Cropping to height: ${finalHeight} (was ${cropHeight}, QR detected: ${qrDetected})`);
    
    // === DEBUG: Icon zones + QR zone + crop line visualization ===
    if (enableDebugImages) {
      const zoneDebugMat = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('cvtColor', grayMat, zoneDebugMat, 8, 0); // COLOR_GRAY2BGR = 8

      // 1. Draw icon detection zones (green=active, red=inactive)
      for (let i = 0; i < 7; i++) {
        const sliceX = marginLeft + i * sliceWidth;
        const sliceW = Math.min(sliceWidth, cropWidth - sliceX);
        const x1 = sliceX;
        const y1 = bottom5StartY;
        const x2 = sliceX + sliceW;
        const y2 = bottom5StartY + bottom5Height;
        
        const r = iconActive[i] ? 0 : 255;
        const g = iconActive[i] ? 255 : 0;
        const color = OpenCV.createObject(ObjectType.Scalar, 0, g, r, 255); // BGR
        
        const tl = OpenCV.createObject(ObjectType.Point, x1, y1);
        const tr = OpenCV.createObject(ObjectType.Point, x2, y1);
        const br = OpenCV.createObject(ObjectType.Point, x2, y2);
        const bl = OpenCV.createObject(ObjectType.Point, x1, y2);
        OpenCV.invoke('line', zoneDebugMat, tl, tr, color, 6, 8);
        OpenCV.invoke('line', zoneDebugMat, tr, br, color, 6, 8);
        OpenCV.invoke('line', zoneDebugMat, br, bl, color, 6, 8);
        OpenCV.invoke('line', zoneDebugMat, bl, tl, color, 6, 8);
      }

      // 2. Draw QR search zone (alsó 15% — cyan dashed area outline)
      const qrSearchStartY = cropHeight - Math.round(cropHeight * 0.15);
      const cyanColor = OpenCV.createObject(ObjectType.Scalar, 255, 255, 0, 255); // BGR: cyan
      const qzTl = OpenCV.createObject(ObjectType.Point, 0, qrSearchStartY);
      const qzTr = OpenCV.createObject(ObjectType.Point, cropWidth, qrSearchStartY);
      const qzBr = OpenCV.createObject(ObjectType.Point, cropWidth, cropHeight);
      const qzBl = OpenCV.createObject(ObjectType.Point, 0, cropHeight);
      OpenCV.invoke('line', zoneDebugMat, qzTl, qzTr, cyanColor, 4, 8);
      OpenCV.invoke('line', zoneDebugMat, qzTr, qzBr, cyanColor, 4, 8);
      OpenCV.invoke('line', zoneDebugMat, qzBr, qzBl, cyanColor, 4, 8);
      OpenCV.invoke('line', zoneDebugMat, qzBl, qzTl, cyanColor, 4, 8);

      // 3. Draw final crop line (yellow horizontal line at finalHeight)
      const yellowColor = OpenCV.createObject(ObjectType.Scalar, 0, 255, 255, 255); // BGR: yellow
      const cropLineL = OpenCV.createObject(ObjectType.Point, 0, finalHeight);
      const cropLineR = OpenCV.createObject(ObjectType.Point, cropWidth, finalHeight);
      OpenCV.invoke('line', zoneDebugMat, cropLineL, cropLineR, yellowColor, 8, 8);

      // 4. Always show fallback indicators for debugging
      {
        const magentaColor = OpenCV.createObject(ObjectType.Scalar, 255, 0, 255, 255); // BGR: magenta
        const fallback90Y = Math.round(cropHeight * 0.90);
        const fbLineL = OpenCV.createObject(ObjectType.Point, 0, fallback90Y);
        const fbLineR = OpenCV.createObject(ObjectType.Point, cropWidth, fallback90Y);
        OpenCV.invoke('line', zoneDebugMat, fbLineL, fbLineR, magentaColor, 4, 8);
        
        // Draw X markers on icon zones to show they are in the cropped-away area
        for (let i = 0; i < 7; i++) {
          const sliceX = marginLeft + i * sliceWidth;
          const sliceW = Math.min(sliceWidth, cropWidth - sliceX);
          const cx = sliceX + Math.round(sliceW / 2);
          const cy = bottom5StartY + Math.round(bottom5Height / 2);
          const halfSize = Math.round(Math.min(sliceW, bottom5Height) * 0.3);
          
          const xColor = OpenCV.createObject(ObjectType.Scalar, 0, 0, 255, 255); // BGR: red
          const xTl = OpenCV.createObject(ObjectType.Point, cx - halfSize, cy - halfSize);
          const xBr = OpenCV.createObject(ObjectType.Point, cx + halfSize, cy + halfSize);
          const xTr = OpenCV.createObject(ObjectType.Point, cx + halfSize, cy - halfSize);
          const xBl = OpenCV.createObject(ObjectType.Point, cx - halfSize, cy + halfSize);
          OpenCV.invoke('line', zoneDebugMat, xTl, xBr, xColor, 4, 8);
          OpenCV.invoke('line', zoneDebugMat, xTr, xBl, xColor, 4, 8);
        }
      }
      
      const zoneDebugResult = OpenCV.toJSValue(zoneDebugMat);
      if (zoneDebugResult?.base64) {
        stepImages.push({
          label: `3. Zones: icon(green/red) QR(cyan) crop(yellow) fallback90%(magenta) QR:${qrDetected ? 'YES' : 'NO'}`,
          image: zoneDebugResult.base64,
        });
      }
    }

    const finalCropRect = OpenCV.createObject(
      ObjectType.Rect,
      0, // x
      0, // y
      cropWidth, // width (full width)
      finalHeight, // height (smart crop)
    );
    
    const croppedFinalMat = OpenCV.createObject(
      ObjectType.Mat,
      finalHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('crop', finalMat, croppedFinalMat, finalCropRect);
    console.log('✅ Smart bottom crop completed');

    // Step 9.5: After smart bottom crop
    if (enableDebugImages) {
      const step9_5Result = OpenCV.toJSValue(croppedFinalMat);
      if (step9_5Result?.base64) {
        stepImages.push({ label: '9.5. Smart bottom crop', image: step9_5Result.base64 });
      }
    }

    // === EDGE CROP - Remove 0.5% border to avoid black edges ===
    const edgeCropPercent = 0;
    const edgeCropLeft = Math.round(cropWidth * edgeCropPercent);
    const edgeCropTop = Math.round(finalHeight * edgeCropPercent);
    const edgeCropWidth = cropWidth - 2 * edgeCropLeft;
    const edgeCropHeight = finalHeight - 2 * edgeCropTop;
    
    const edgeCropRect = OpenCV.createObject(
      ObjectType.Rect,
      edgeCropLeft,
      edgeCropTop,
      edgeCropWidth,
      edgeCropHeight,
    );
    
    const finalCleanMat = OpenCV.createObject(
      ObjectType.Mat,
      edgeCropHeight,
      edgeCropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('crop', croppedFinalMat, finalCleanMat, edgeCropRect);
    console.log('✅ Edge crop completed');
    console.log(`📐 Final dimensions after all crops: ${edgeCropWidth}x${edgeCropHeight}`);

    // Step 9.6: After edge crop
    if (enableDebugImages) {
      const step9_6Result = OpenCV.toJSValue(finalCleanMat);
      if (step9_6Result?.base64) {
        stepImages.push({ label: '9.6. Edge crop (0.5%)', image: step9_6Result.base64 });
      }
    }

    // === RESTORE COLORED REGIONS + DARK INK - Visszamaszkolás ===
    console.log('🎨 Restoring colored regions and dark ink over processed B&W image');
    
    // Crop the color mask and colored regions to match final dimensions
    const colorMaskCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    
    // Build combined crop rect (bottom + edge)
    const combinedCropLeft = edgeCropLeft;
    const combinedCropTop = edgeCropTop;
    const finalCombinedRect = OpenCV.createObject(
      ObjectType.Rect,
      combinedCropLeft,
      combinedCropTop,
      edgeCropWidth,
      edgeCropHeight,
    );
    
    OpenCV.invoke('crop', colorMaskDilated, colorMaskCropped, finalCombinedRect);
    
    const coloredRegionsCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('crop', coloredRegions, coloredRegionsCropped, finalCombinedRect);
    
    // Crop dark ink mask to match final dimensions
    const darkInkMaskCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('crop', darkInkMaskDilated, darkInkMaskCropped, finalCombinedRect);
    
    // COLOR HAS PRIORITY over dark ink — remove dark ink where color mask exists
    const notColorCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', colorMaskCropped, notColorCropped);
    OpenCV.invoke('bitwise_and', darkInkMaskCropped, notColorCropped, darkInkMaskCropped);
    
    // === SOFT ALPHA BLENDING for natural color transition ===
    // Instead of hard binary mask, blur the color mask for gradual edge blending
    console.log('🎨 Applying soft alpha blending for color regions');
    
    // 1. GaussianBlur the color mask → soft alpha (0-255 gradient at edges)
    // Small kernel = narrow transition zone, avoids shadow-like halo from original photo background
    const softColorMask = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    const softBlurKsize = createSize(cfg.colorMaskSoftBlendSize, cfg.colorMaskSoftBlendSize);
    OpenCV.invoke('GaussianBlur', colorMaskCropped, softColorMask, softBlurKsize, 0, 0, 4); // BORDER_DEFAULT=4
    
    // 2. Zero out dark ink areas from soft color mask (dark ink stays pure black)
    const notDarkInkMask = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', darkInkMaskCropped, notDarkInkMask);
    OpenCV.invoke('bitwise_and', softColorMask, notDarkInkMask, softColorMask);
    
    // 3. Crop original image to final dimensions (need unmasked original for blending)
    const originalCropped = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('crop', croppedMat, originalCropped, finalCombinedRect);
    
    // 4. Convert soft mask to 3-channel for multiply
    const softAlpha3ch = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('cvtColor', softColorMask, softAlpha3ch, 8, 0); // COLOR_GRAY2BGR = 8
    
    const invSoftAlpha3ch = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_not', softAlpha3ch, invSoftAlpha3ch);
    
    // 5. Alpha blend: result = (original * softAlpha + bw * invSoftAlpha) / 255
    const weightedOriginal = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('multiply', originalCropped, softAlpha3ch, weightedOriginal, 1.0 / 255.0);
    
    const weightedBW = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('multiply', finalCleanMat, invSoftAlpha3ch, weightedBW, 1.0 / 255.0);
    
    const blendedResult = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', weightedOriginal, weightedBW, blendedResult);
    
    // 6. Dark ink: use original dark pixels darkened to preserve tonal variation
    // Extract original pixels where dark ink mask is active
    const darkInkOriginal = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', originalCropped, originalCropped, darkInkOriginal, darkInkMaskCropped);
    // Darken to ~50% brightness: enough to see subtle shading, still dark overall
    const darkenedInk = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', darkInkOriginal, darkenedInk, cfg.darkInkDarkenFactor, 0);
    
    // Combine: blended (with dark ink areas zeroed) + darkened ink
    const blendedNoDark = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', blendedResult, blendedResult, blendedNoDark, notDarkInkMask);
    const finalWithColor = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', blendedNoDark, darkenedInk, finalWithColor);
    
    console.log('✅ Soft color blending + dark ink restored!');

    // Step 9.7: After color restoration
    if (enableDebugImages) {
      const step9_7Result = OpenCV.toJSValue(finalWithColor);
      if (step9_7Result?.base64) {
        stepImages.push({ label: '9.7. Colors restored', image: step9_7Result.base64 });
      }
    }

    // === LIGHT BLUR - Smooth edges slightly ===
    // DISABLED FOR SPEED TEST
    /*
    console.log('🌊 Applying light Gaussian blur for smooth edges');
    const finalSmoothedWithColor = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    const lightBlurKsize = OpenCV.createObject(ObjectType.Size, 3, 3);
    OpenCV.invoke('GaussianBlur', finalWithColor, finalSmoothedWithColor, lightBlurKsize, 0.5, 0.5, 4);
    console.log(`✅ Final size: ${edgeCropWidth}x${edgeCropHeight} (light blur applied)`);
    */
    const finalSmoothedWithColor = finalWithColor; // Use directly without blur
    console.log(`✅ Final size: ${edgeCropWidth}x${edgeCropHeight} (no blur)`);

    // === FLOOD FILL DARK EDGES ===
    // Walk along all 4 edges. Only flood-fill from DARK seed pixels (< threshold).
    // This avoids washing out light content (dots, pencil marks).
    let floodFillCount = 0;
    let floodFillSkipped = 0;
    const FLOOD_DARK_THRESH = 200; // Only seed from pixels darker than this
    try {
      // Get grayscale to check seed pixel brightness
      const ffGray = createMat(edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
      OpenCV.invoke('cvtColor', finalSmoothedWithColor, ffGray, 6, 0);

      // floodFill needs a mask that is 2px bigger than the image
      const ffMaskH = edgeCropHeight + 2;
      const ffMaskW = edgeCropWidth + 2;
      const ffMask = createMat(ffMaskH, ffMaskW, DataTypes.CV_8UC1);

      const ffWhite = OpenCV.createObject(ObjectType.Scalar, 255, 255, 255, 255);
      const ffLoDiff = OpenCV.createObject(ObjectType.Scalar, 25, 25, 25, 0);
      const ffUpDiff = OpenCV.createObject(ObjectType.Scalar, 25, 25, 25, 0);
      const ffRect = OpenCV.createObject(ObjectType.Rect, 0, 0, 0, 0);
      // flags: 8-connectivity | FLOODFILL_FIXED_RANGE
      const ffFlags = 8 | 65536;

      // Helper: check if seed pixel is dark enough
      const isDarkSeed = (x: number, y: number): boolean => {
        const pixRect = OpenCV.createObject(ObjectType.Rect, x, y, 1, 1);
        const pixMat = OpenCV.createObject(ObjectType.Mat, 1, 1, DataTypes.CV_8UC1);
        OpenCV.invoke('crop', ffGray, pixMat, pixRect);
        const pixMean = OpenCV.invoke('mean', pixMat);
        const pixData = OpenCV.toJSValue(pixMean);
        return (pixData?.a ?? 255) < FLOOD_DARK_THRESH;
      };

      const step = 5; // Check every 5 pixels

      // Left edge
      for (let y = 0; y < edgeCropHeight; y += step) {
        if (isDarkSeed(0, y)) {
          const seedPt = OpenCV.createObject(ObjectType.Point, 0, y);
          try {
            OpenCV.invoke('floodFill', finalSmoothedWithColor, ffMask, seedPt, ffWhite, ffRect, ffLoDiff, ffUpDiff, ffFlags);
            floodFillCount++;
          } catch (_e) {}
        } else { floodFillSkipped++; }
      }

      // Right edge
      for (let y = 0; y < edgeCropHeight; y += step) {
        if (isDarkSeed(edgeCropWidth - 1, y)) {
          const seedPt = OpenCV.createObject(ObjectType.Point, edgeCropWidth - 1, y);
          try {
            OpenCV.invoke('floodFill', finalSmoothedWithColor, ffMask, seedPt, ffWhite, ffRect, ffLoDiff, ffUpDiff, ffFlags);
            floodFillCount++;
          } catch (_e) {}
        } else { floodFillSkipped++; }
      }

      // Top edge
      for (let x = 0; x < edgeCropWidth; x += step) {
        if (isDarkSeed(x, 0)) {
          const seedPt = OpenCV.createObject(ObjectType.Point, x, 0);
          try {
            OpenCV.invoke('floodFill', finalSmoothedWithColor, ffMask, seedPt, ffWhite, ffRect, ffLoDiff, ffUpDiff, ffFlags);
            floodFillCount++;
          } catch (_e) {}
        } else { floodFillSkipped++; }
      }

      // Bottom edge
      for (let x = 0; x < edgeCropWidth; x += step) {
        if (isDarkSeed(x, edgeCropHeight - 1)) {
          const seedPt = OpenCV.createObject(ObjectType.Point, x, edgeCropHeight - 1);
          try {
            OpenCV.invoke('floodFill', finalSmoothedWithColor, ffMask, seedPt, ffWhite, ffRect, ffLoDiff, ffUpDiff, ffFlags);
            floodFillCount++;
          } catch (_e) {}
        } else { floodFillSkipped++; }
      }

      fullEdgeCorrectionInfo += `\n\n=== FLOOD FILL ===\nFilled: ${floodFillCount}, Skipped(bright): ${floodFillSkipped}, Thresh: ${FLOOD_DARK_THRESH}, LoDiff/UpDiff: 25`;
      console.log(`🟩 Flood fill: ${floodFillCount} dark seeds filled, ${floodFillSkipped} bright seeds skipped`);
    } catch (ffErr) {
      fullEdgeCorrectionInfo += `\n\n=== FLOOD FILL ===\nError: ${ffErr}`;
      console.warn('⚠️ Flood fill failed:', ffErr);
    }

    // Step 9.8: After anti-aliasing
    if (enableDebugImages) {
      const step9_8Result = OpenCV.toJSValue(finalSmoothedWithColor);
      if (step9_8Result?.base64) {
        stepImages.push({ label: '9.8. Anti-aliasing', image: step9_8Result.base64 });
      }
    }

    // === UPSCALE - Felskálázás nagyobb felbontásra ===
    /* const UPSCALE_FACTOR = 1.5; // 1.5x nagyítás (150%)
    const upscaledWidth = Math.round(edgeCropWidth * UPSCALE_FACTOR);
    const upscaledHeight = Math.round(edgeCropHeight * UPSCALE_FACTOR);
    
    console.log(`🔍 Upscaling image: ${edgeCropWidth}x${edgeCropHeight} → ${upscaledWidth}x${upscaledHeight} (${UPSCALE_FACTOR}x)`);
    
    const upscaledMat = OpenCV.createObject(ObjectType.Mat, upscaledHeight, upscaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'resize',
      finalWithColor,
      upscaledMat,
      createSize(upscaledWidth, upscaledHeight),
      0,
      0,
      2, // INTER_CUBIC = 2 - jó minőségű interpoláció
    );
    
    console.log('✅ Upscaling completed'); */

    // === QR KÓD INFORMÁCIÓK LOGOLÁSA ===
    console.log('📱 QR Code Info:', {
      value: currentQrValue || 'N/A',
      position: currentQrPosition || 'N/A',
    });

    // Export final image with best available quality
    // Note: react-native-fast-opencv uses built-in JPEG encoding (~95% quality)
    // This is the maximum quality available with this library
    console.log('📸 Exporting with maximum available JPEG quality');
    
    const result = OpenCV.toJSValue(finalSmoothedWithColor);

    if (!result?.base64) {
      throw new Error('Failed to convert scanned image to base64');
    }

    console.log('✅ High-quality image export completed');

    // === ADD FINAL RESULT TO DEBUG IMAGES ===
    if (enableDebugImages && result.base64) {
      stepImages.push({ 
        label: `10. Final Result${currentQrValue ? ` - QR: ${currentQrValue}` : ''}`, 
        image: result.base64 
      });
    }

    return {
      success: true,
      imageBase64: result.base64,
      stepImages: enableDebugImages ? stepImages : [], // Only return debug images if enabled
      qrValue: currentQrValue, // QR kód tartalma a frame-ből
      qrPosition: currentQrPosition, // QR kód pozíciója
      brightnessInfo: {
        avgBrightness: 128,
        lightCondition: 'Normal',
        betaBoost: 0,
      },
      selectedIcons: detectedIcons,
      selectedIconNames: detectedIconNames,
      iconAnalysis: iconActive.map((a, i) => ({ slot: i + 1, icon: iconNames[i], active: a, darkPercent: iconDarkPercents[i] })),
      edgeCorrectionInfo: fullEdgeCorrectionInfo,
    };
  } catch (error) {
    console.error('Scan error:', error);
    try {
      OpenCV.clearBuffers();
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      OpenCV.clearBuffers();
    } catch (clearError) {
      console.error('Error clearing OpenCV buffers:', clearError);
    }
  }
};
