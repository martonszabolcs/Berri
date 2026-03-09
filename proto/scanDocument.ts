import { Alert } from 'react-native';
import { OpenCV, ObjectType, DataTypes, ColorConversionCodes, RetrievalModes, ContourApproximationModes } from 'react-native-fast-opencv';
import { detectDocumentCorners } from './detectDocumentCorners';

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
    lightCondition: 'Nappali' | 'Normál' | 'Éjjeli';
    betaBoost: number;
  };
  selectedIcons?: number[];
  selectedIconNames?: string[];
  iconAnalysis?: {
    segment: number;
    darkPixelRatio: number;
  }[];
  debugCorners?: {
    index: number;
    x: number;
    y: number;
  }[];
}

const SCALE_FACTOR = 1.0;
const CROP_PERCENT = 0.007; // Disabled - no initial crop

// Target output resolution - A4-like at 300 DPI equivalent
// 5:3 aspect ratio (BERRĪ notebook), high resolution output
const TARGET_OUTPUT_WIDTH = 2100;  // ~300 DPI width
const TARGET_OUTPUT_HEIGHT = 3500; // ~300 DPI height (5:3 ratio)

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
    frameCorners, // Frame-ből detektált sarkok
    processedCorners, // Teljes felbontású fotóhoz felskálázott sarkok
    currentQrValue, // QR kód tartalma
    currentQrPosition, // QR kód pozíciója
    photoWidth: providedWidth,
    photoHeight: providedHeight,
    frameWidth: providedFrameWidth,
    frameHeight: providedFrameHeight,
    frameBrightness = 128, // Default if not provided
    enableDebugImages = true, // Default: debug images enabled
  } = params;

  try {
    if (frameCorners.length !== 4 || processedCorners.length !== 4) {
      return {
        success: false,
        error: 'Pontosan 4 sarok szükséges mindkét detektáláshoz',
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

    // === DEBUG KÉP 0.2 - Downscaled kép (720x1280) amit a detection használ ===
    if (photoDetectionResult.debugImage) {
      stepImages.push({
        label: '0.2. Downscaled kép (720x1280) - detection input',
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
          label: '0.12. Photo edges (zöld=detected document)',
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
    
    if (photoDetectionResult.corners) {
      // Fotó detektálás sikeres - MINDIG ezt használjuk (nincs mozgás ellenőrzés, nincs átlagolás)
      console.log('✅ Using photo-detected corners');
      corners = photoDetectionResult.corners;
      cornerSource = 'photo';
    } else {
      // Fotó detektálás sikertelen - VISSZADOBJUK A HIBÁT!
      // NEM használhatjuk a frame sarokpontokat, mert a felhasználó mozoghatott közben!
      console.error('❌ Photo detection failed - ABORTING scan process');
      return {
        success: false,
        error: 'Nem sikerült detektálni a dokumentumot a fotón. Próbáld újra!',
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
    const dstSize = createSize(width, height);
    const borderValue = OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0);

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
      stepImages.push({ label: '0.13. Eredeti fotó (eredeti orientáció)', image: step0Result.base64 });
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
        label: `1. Vágott kép`,
        image: step1Result.base64 
      });
    }

    // === COLOR MASK DETECTION - Detektáljuk a színes területeket ===
    console.log('🎨 Detecting VIBRANT colored regions for preservation');
    
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
    
    // VERY STRICT threshold: csak NAGYON élénk színek (saturation > 90)
    // Flash esetén a háttér is színesnek tűnhet, ezért kell a szigorúbb threshold
    const colorMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', saturation, colorMask, 70, 255, 0); // THRESH_BINARY = 0, threshold=90 (was 60)
    
    // Minimum brightness filter - túl sötét pixelek nem számítanak (árnyékok)
    const brightMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', maxChannel, brightMask, 60, 255, 0); // min brightness > 60 (was 50)
    
    // Maximum brightness filter - túl világos pixelek (fehér papír, flash tükröződés) nem számítanak
    const notTooWhiteMask = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', maxChannel, notTooWhiteMask, 240, 255, 1); // THRESH_BINARY_INV = 1, max < 240
    
    // Combine saturation + brightness + not-too-white filters
    const colorMaskFiltered = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', colorMask, brightMask, colorMaskFiltered);
    OpenCV.invoke('bitwise_and', colorMaskFiltered, notTooWhiteMask, colorMaskFiltered);
    
    // Dilate mask slightly to include edges
    const dilateKernel = OpenCV.invoke('getStructuringElement', 2, createSize(5, 5)); // MORPH_ELLIPSE = 2
    const colorMaskDilated = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', colorMaskFiltered, colorMaskDilated, 1, dilateKernel); // MORPH_DILATE = 1
    
    // Store original colored regions
    const coloredRegions = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', croppedMat, croppedMat, coloredRegions, colorMaskDilated);
    
    console.log('✅ Strict color mask created - saturation>90, brightness 60-240 only');

    // Step 1.5: Color mask visualization
    const colorMaskBGR = OpenCV.createObject(ObjectType.Mat, cropHeight, cropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('cvtColor', colorMaskDilated, colorMaskBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step1_5Result = OpenCV.toJSValue(colorMaskBGR);
    if (step1_5Result?.base64) {
      stepImages.push({ label: '2. Színes maszk (saturation)', image: step1_5Result.base64 });
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

    // === BRIGHTNESS DETECTION using minMaxLoc ===
    console.log('💡 Detecting image brightness with minMaxLoc');
    const minMaxResult = OpenCV.invoke('minMaxLoc', grayMat) as any;
    const minVal = minMaxResult?.minVal ?? 0;
    const maxVal = minMaxResult?.maxVal ?? 255;
    const range = maxVal - minVal;

    const avgBrightness = Math.round(
      range > 150
        ? minVal * 0.2 + maxVal * 0.8
        : range > 100
        ? minVal * 0.3 + maxVal * 0.7
        : (minVal + maxVal) / 2,
    );

    console.log('📊 Brightness analysis:', {
      minVal,
      maxVal,
      range,
      avgBrightness,
      method:
        range > 150
          ? 'high-contrast'
          : range > 100
          ? 'medium-contrast'
          : 'low-contrast',
    });

    const rawBeta = Math.pow(Math.max(0, 230 - avgBrightness), 1.2) * 0.2;
    const betaBoost = Math.round(Math.max(0, Math.min(80, rawBeta)));

    const lightCondition: 'Nappali' | 'Normál' | 'Éjjeli' =
      avgBrightness > 180
        ? 'Nappali'
        : avgBrightness > 120
        ? 'Normál'
        : 'Éjjeli';

    console.log('💡 Brightness detection:', {
      avgBrightness: avgBrightness.toFixed(1),
      betaBoost,
      lightCondition,
    });
    
    // Determine enhancement parameters based on brightness
    let alpha: number;
    let beta: number;
    
    if (avgBrightness < 150) {
      // Dark image - need stronger boost
      alpha = 1.8;
      beta = betaBoost;
      console.log('🌑 Dark image detected - strong enhancement');
    } else if (avgBrightness > 150 && avgBrightness <= 200) {
      // Bright image - gentle enhancement
      alpha = 1;
      beta = 1;
      console.log('☀️ Bright image detected - gentle enhancement');
    } else {
      // Normal image - moderate enhancement
      alpha = 0.8;
      beta = Math.min(15, betaBoost);
      console.log('🌤️ Normal brightness - moderate enhancement');
    }

    // === ADAPTIVE CONTRAST & BRIGHTNESS ENHANCEMENT ===
    console.log(`🔆 Applying contrast: ${alpha}x, brightness: +${beta}`);
    const processedGray = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('convertScaleAbs', grayMat, processedGray, alpha, beta);

    // Step 2: Enhanced grayscale
    const grayMatBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', processedGray, grayMatBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step2Result = OpenCV.toJSValue(grayMatBGR);
    if (step2Result?.base64) {
      stepImages.push({ 
        label: `3. Grayscale + Kontraszt (${alpha}x, +${beta})`, 
        image: step2Result.base64 
      });
    }

    // === SHARPENING - Before threshold for better edge detection ===
    console.log('🔪 Applying aggressive sharpening before threshold');
    
    // Gaussian blur for unsharp mask
    const blurredSharp = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    const sharpenKsize = OpenCV.createObject(ObjectType.Size, 0, 0);
    OpenCV.invoke('GaussianBlur', processedGray, blurredSharp, sharpenKsize, 3, 3, 4);
    
    // Unsharp mask: result = original * 2 - blurred * 1 (sum = 1 for proper balance)
    // FONTOS: α - β = 1 kell legyen! (2-1=1)
    const sharpenedGray = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('addWeighted', processedGray, 6, blurredSharp, -5, 0, sharpenedGray);
    console.log('✅ Aggressive sharpening completed');

    // Step 3: Sharpened grayscale
    const sharpenedGrayBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', sharpenedGray, sharpenedGrayBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step3Result = OpenCV.toJSValue(sharpenedGrayBGR);
    if (step3Result?.base64) {
      stepImages.push({ label: '4. Élesítés (sharpening)', image: step3Result.base64 });
    }

    // === BLACK MASK (THRESHOLD) ===
    console.log('🎭 Creating adaptive black mask based on resolution');
    
    // First, calculate optimal threshold using Otsu's method
    const tempMaskMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    const otsuResult = OpenCV.invoke('threshold', sharpenedGray, tempMaskMat, 0, 255, 8); // THRESH_OTSU = 8
    const otsuThreshold = typeof otsuResult === 'number' ? otsuResult : 128;
    console.log('📊 Otsu calculated threshold:', otsuThreshold);
    
    // === RESOLUTION + BRIGHTNESS ADAPTIVE THRESHOLD ===
    // iPhone 15 (48 MP): 0.25 → mindig agresszív (elég detail)
    // iPhone 12 (12 MP) + lámpafény (sötét): 0.75 → enyhébb (ne nyúljon bele a szövegbe)
    // iPhone 12 (12 MP) + nappali fény (világos): 0.45 → köztes (zajok ne jöjjenek be)
    const totalPixels = cropWidth * cropHeight;
    //const isHighRes = false; // TESZT: mindig 12MP-ként kezel (iPhone 12 szimuláció)
    const isHighRes = totalPixels > 3_000_000; // > 3 megapixel threshold (48MP vs 12MP)
    const isDark = avgBrightness < 120; // Lámpafény (sötét környezet)
    // Felbontás + fényerő alapú threshold multiplier
    let thresholdMultiplier: number;
    let reasoning: string;
    
    if (isHighRes) {
      // Nagy felbontás (iPhone 15) - mindig agresszív
      thresholdMultiplier = 0.25;
      reasoning = 'iPhone 15 (48MP) - agresszív threshold';
    } else if (isDark) {
      // Kis felbontás + lámpafény - enyhébb (ne törölje a szöveget)
      thresholdMultiplier = 0.75;
      reasoning = 'iPhone 12 (12MP) + lámpafény - enyhébb threshold';
    } else {
      // Kis felbontás + nappali fény - köztes (zajok ne jöjjenek)
      thresholdMultiplier = 0.45;
      reasoning = 'iPhone 12 (12MP) + nappali fény - köztes threshold';
    }
    
    console.log('📐 Resolution + Brightness threshold:', {
      totalPixels,
      avgBrightness,
      isHighRes,
      isDark,
      multiplier: thresholdMultiplier,
      reasoning,
    });
    
    // Apply adaptive threshold
    const maskMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    const adjustedThreshold = Math.max(25, otsuThreshold * thresholdMultiplier);
    OpenCV.invoke('threshold', sharpenedGray, maskMat, adjustedThreshold, 255, 0); // THRESH_BINARY = 0
    console.log('✅ Adaptive black mask created with adjusted threshold:', adjustedThreshold);

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
    const kernel = OpenCV.invoke('getStructuringElement', 0, createSize(2, 2)); // MORPH_RECT = 0, 2x2 kernel
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
      stepImages.push({ label: '6. Zaj eltávolítás (opening)', image: step5Result.base64 });
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
      stepImages.push({ label: '6.5. Lyukak betömése (closing)', image: step5_5Result.base64 });
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
      stepImages.push({ label: '7. Szöveg vastagítás (dilate)', image: step6Result.base64 });
    }

    // === MEDIAN BLUR - Remove dots/noise while preserving edges ===
    console.log('🎯 Applying stronger median blur to remove dots/noise');
    const medianFiltered = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    // Median blur with 7x7 kernel - stronger noise removal
    // while preserving edges better than Gaussian blur
    OpenCV.invoke('medianBlur', finalThickened, medianFiltered, 5);
    console.log('✅ Stronger median blur completed - dots removed');

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
      stepImages.push({ label: '8. Median blur (pöttyök eltávolítás)', image: step6_5Result.base64 });
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

    // === FINAL SHARPENING - Restore crispness after median blur ===
    console.log('✨ Applying aggressive final sharpening for crisp text');
    
    // Gaussian blur for unsharp mask
    const blurredFinalSharp = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    const finalSharpenKsize = OpenCV.createObject(ObjectType.Size, 0, 0);
    OpenCV.invoke('GaussianBlur', medianFiltered, blurredFinalSharp, finalSharpenKsize, 3, 3, 4);
    
    // Unsharp mask with VERY aggressive sharpening: original * 4 - blurred * 3
    const sharpenedFinal = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('addWeighted', medianFiltered, 2, blurredFinalSharp, -1, 0, sharpenedFinal);
    console.log('✅ Aggressive final sharpening completed');

    // Step 9: Final sharpening
    const sharpenedFinalBGR = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', sharpenedFinal, sharpenedFinalBGR, 8, 0); // COLOR_GRAY2BGR = 8
    const step9Result = OpenCV.toJSValue(sharpenedFinalBGR);
    if (step9Result?.base64) {
      stepImages.push({ label: '9. Élesítés (sharpen)', image: step9Result.base64 });
    }

    // Use sharpened result as final
    const blurredFinal = sharpenedFinal;

    // Convert back to BGR for consistency with rest of code
    const finalMat = OpenCV.createObject(
      ObjectType.Mat,
      cropHeight,
      cropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('cvtColor', blurredFinal, finalMat, 8, 0); // COLOR_GRAY2BGR = 8

    // === SMART CROP BOTTOM - Find square QR code at bottom ===
    console.log('✂️ Smart cropping bottom - searching for square QR code');
    
    // A QR kód négyzet alakú, fekete, a kép alján van fehér háttéren
    // Keresünk egy négyzet alakú sötét területet az alsó 25%-ban
    let qrEndY = cropHeight; // Default: no crop if detection fails
    let qrDetected = false;
    
    try {
      // Csak az alsó 25%-ot vizsgáljuk - itt van a QR kód
      const searchHeight = Math.round(cropHeight * 0.30);
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
      OpenCV.invoke('crop', blurredFinal, bottomMat, bottomRect);
      
      // Threshold - invertálva, hogy a fekete QR kód fehér legyen (kontúr kereséshez)
      const threshMat = OpenCV.createObject(ObjectType.Mat, searchHeight, cropWidth, DataTypes.CV_8UC1);
      OpenCV.invoke('threshold', bottomMat, threshMat, 180, 255, 1); // THRESH_BINARY_INV = 1
      
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
      
      // Minimum QR méret: a kép szélességének 5%-a négyzet
      const minQrSize = cropWidth * 0.05;
      const minQrArea = minQrSize * minQrSize;
      
      // Maximum QR méret: a kép szélességének 20%-a négyzet
      const maxQrSize = cropWidth * 0.20;
      const maxQrArea = maxQrSize * maxQrSize;
      
      for (let i = 0; i < contoursSize; i++) {
        const contour = OpenCV.copyObjectFromVector(contours, i);
        const boundingRect = OpenCV.invoke('boundingRect', contour);
        const rectData = OpenCV.toJSValue(boundingRect);
        
        if (rectData) {
          const { x, y, width: w, height: h } = rectData;
          const area = w * h;
          
          // Négyzet alakú? (aspect ratio 0.7 - 1.3 között)
          const aspectRatio = w / h;
          const isSquare = aspectRatio >= 0.7 && aspectRatio <= 1.3;
          
          // Megfelelő méretű?
          const isSizeOk = area >= minQrArea && area <= maxQrArea;
          
          if (isSquare && isSizeOk && area > bestQrArea) {
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
      } else {
        // Fallback: 93% ha nem találtunk QR kódot
        qrEndY = Math.round(cropHeight * 0.8);
        console.log('⚠️ No square QR code found, using fallback 93%');
      }
      
    } catch (qrError) {
      console.warn('⚠️ QR detection error:', qrError);
      qrEndY = Math.round(cropHeight * 0.8);
    }
    
    // Add margin above QR top - biztonsági margó a QR kód fölött
    const margin = Math.round(cropHeight * 0.01); // 1% margin
    
    // Ha találtunk QR kódot, akkor annak tetejéig tartjuk meg a képet
    // qrEndY = a QR kód TETEJE (y koordináta a kép tetejétől)
    // finalHeight = ennyi pixelt tartunk meg felülről
    let finalHeight: number;
    if (qrDetected) {
      // qrEndY a QR kód teteje, margin-t hozzáadunk hogy ne vágjuk le véletlenül
      finalHeight = qrEndY + margin;
      // Minimum 85% marad, maximum 98%
      finalHeight = Math.max(finalHeight, Math.round(cropHeight * 0.85));
      finalHeight = Math.min(finalHeight, Math.round(cropHeight * 0.98));
      console.log(`📐 QR top at Y=${qrEndY}, margin=${margin}, finalHeight=${finalHeight} (${((finalHeight/cropHeight)*100).toFixed(1)}%)`);
    } else {
      // Fallback: 93% marad
      finalHeight = Math.round(cropHeight * 0.93);
    }
    
    console.log(`📐 Cropping to height: ${finalHeight} (was ${cropHeight}, QR detected: ${qrDetected})`);
    
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
    // Edge crop disabled - no border removal
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

    // === RESTORE COLORED REGIONS - Visszamaszkolás ===
    console.log('🎨 Restoring colored regions over processed B&W image');
    
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
    
    // Invert mask for B&W areas
    const bwMask = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', colorMaskCropped, bwMask);
    
    // Apply masks
    const bwPart = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', finalCleanMat, finalCleanMat, bwPart, bwMask);
    
    // Combine B&W and colored regions
    const finalWithColor = OpenCV.createObject(ObjectType.Mat, edgeCropHeight, edgeCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', bwPart, coloredRegionsCropped, finalWithColor);
    
    console.log('✅ Colored regions restored!');

    // Step 9.7: After color restoration
    if (enableDebugImages) {
      const step9_7Result = OpenCV.toJSValue(finalWithColor);
      if (step9_7Result?.base64) {
        stepImages.push({ label: '9.7. Színek visszaállítva', image: step9_7Result.base64 });
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
        label: `10. Végeredmény${currentQrValue ? ` - QR: ${currentQrValue}` : ''}`, 
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
        lightCondition: 'Normál',
        betaBoost: 0,
      },
      selectedIcons: [],
      selectedIconNames: [],
      iconAnalysis: [],
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
