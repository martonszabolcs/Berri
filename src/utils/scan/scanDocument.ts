import { OpenCV, ObjectType, DataTypes } from 'react-native-fast-opencv';

interface DocumentCorner {
  x: number;
  y: number;
}

interface ScanDocumentParams {
  rawImageBase64: string;
  corners: DocumentCorner[];
  currentQrPosition?: 'left' | 'right' | null;
  qrBounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null; // QR kód bounds (frame koordinátákban)
  photoWidth?: number;
  photoHeight?: number;
  frameWidth?: number; // Kamera frame szélessége (natív felbontás)
  frameHeight?: number; // Kamera frame magassága (natív felbontás)
}

interface ScanDocumentResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  brightnessInfo?: {
    avgBrightness: number;
    lightCondition: 'Nappali' | 'Normál' | 'Éjjeli';
    betaBoost: number;
  };
  selectedIcons?: number[]; // Melyik ikonokat választotta ki (0-7), üres tömb ha nincs
  selectedIconNames?: string[]; // Az ikonok nevei
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

// ============= KONSTANSOK =============
const SCALE_FACTOR = 1.0;
const CROP_PERCENT = 0.01;
const SHARPEN_AMOUNT = 1.8;
const SAT_BOOST = 1.5;
const SUPER_SAT_BOOST = 2.0;
const BRIGHTNESS_ALPHA = 1.2;
const FINAL_BRIGHTNESS_ALPHA = 1.08;
const SCAN_CONTRAST_ALPHA = 1.3;
const SCAN_BRIGHTNESS_BETA = 5;

// Ikon nevek
const ICON_NAMES = [
  '', // 0
  'nyíl', // 1
  'gyémánt', // 2
  'alma', // 3
  'csengő', // 4
  'lóhere', // 5
  'csillag', // 6
  'patkó', // 7
];

// ============= HELPER FÜGGVÉNYEK =============
const createMat = (h: number, w: number, type: number) =>
  OpenCV.createObject(ObjectType.Mat, h, w, type);

const createSize = (w: number, h: number) =>
  OpenCV.createObject(ObjectType.Size, w, h);

const createPoint2f = (x: number, y: number) =>
  OpenCV.createObject(ObjectType.Point2f, x, y);

const cvtColorGray = (src: any, dst: any) =>
  OpenCV.invoke('cvtColor', src, dst, 6, 0);

const cvtColorBGR2HSV = (src: any, dst: any) =>
  OpenCV.invoke('cvtColor', src, dst, 40, 0);

const cvtColorHSV2BGR = (src: any, dst: any) =>
  OpenCV.invoke('cvtColor', src, dst, 54, 0);

const cvtColorGray2BGR = (src: any, dst: any) =>
  OpenCV.invoke('cvtColor', src, dst, 8, 0);

// ============= FŐ FÜGGVÉNY =============
export const scanDocument = (
  params: ScanDocumentParams,
): ScanDocumentResult => {
  const {
    rawImageBase64,
    corners,
    photoWidth: providedWidth,
    photoHeight: providedHeight,
    frameWidth: providedFrameWidth,
    frameHeight: providedFrameHeight,
  } = params;

  try {
    if (corners.length !== 4) {
      return {
        success: false,
        error: 'Pontosan 4 sarok szükséges a szkenneléshez',
      };
    }

    // === 1. PERSPEKTÍVA TRANSZFORMÁCIÓ ===
    const srcMat = OpenCV.base64ToMat(rawImageBase64);

    // === FIX: Forgassuk el a fotót 90°-kal jobbra (ROTATE_90_CLOCKWISE) ===
    console.log('🔄 Rotating photo 90° clockwise to fix orientation');
    const tempRotatedMat = createMat(
      providedWidth,
      providedHeight,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('rotate', srcMat, tempRotatedMat, 0); // 0 = ROTATE_90_CLOCKWISE

    // Clone immediately to ensure the rotated Mat is properly stored
    console.log('🔄 Cloning rotated Mat to ensure storage stability');
    const rotatedSrcMat = OpenCV.invoke('clone', tempRotatedMat);

    // Tisztítsuk meg az eredeti és temp Mat-okat azonnal
    try {
      // srcMat már nem kell
      // tempRotatedMat már nem kell (clonolt)
    } catch (e) {
      console.warn('Warning cleaning temp mats:', e);
    }

    // Fotó tényleges mérete - először a paraméterből, ha van
    let photoWidth = providedWidth ?? 0;
    let photoHeight = providedHeight ?? 0;

    console.log('PHOTOWIDTH:', photoWidth);
    console.log('PHOTOHEIGHT:', photoHeight);
    const _detectedWidth = photoWidth;
    const _detectedHeight = photoHeight;

    const hasToSwitchOrientation = photoWidth > photoHeight;

    photoWidth = hasToSwitchOrientation ? _detectedHeight : _detectedWidth;
    photoHeight = hasToSwitchOrientation ? _detectedWidth : _detectedHeight;
    console.log('PHOTOWIDTH2:', photoWidth);
    console.log('PHOTOHEIGHT2:', photoHeight);
    // Ha nem adták meg paraméterként, próbáljuk detektálni
    if (photoWidth === 0 || photoHeight === 0) {
      try {
        // Próbáljuk a size() metódust
        const sizeResult = (srcMat as any).size?.() ?? null;
        if (sizeResult && sizeResult.width && sizeResult.height) {
          photoWidth = sizeResult.width;
          photoHeight = sizeResult.height;
        }
      } catch (e) {
        // Ignore
      }

      // Ha nem sikerült, próbáljuk a cols/rows-t
      if (photoWidth === 0 || photoHeight === 0) {
        photoWidth = (srcMat as any).cols ?? (srcMat as any).width ?? 0;
        photoHeight = (srcMat as any).rows ?? (srcMat as any).height ?? 0;
      }

      // Ha még mindig 0, fallback
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

    // A corners a frame NATÍV felbontásához van skálázva (pl. frame.height x frame.width = 3000x4000)
    // De a FOTÓ mérete lehet más! (pl. 960x1280)
    // Ezért újra kell skálázni a fotó tényleges méretéhez

    const frameWidth = providedFrameWidth ?? 1280;
    const frameHeight = providedFrameHeight ?? 720;
    const frameRotatedWidth = frameHeight; // 90° rotation
    const frameRotatedHeight = frameWidth;

    console.log('🔄 Dimensions:', {
      photo: `${photoWidth}x${photoHeight}`,
      frame: `${frameWidth}x${frameHeight}`,
      frameRotated: `${frameRotatedWidth}x${frameRotatedHeight}`,
      providedFrame:
        providedFrameWidth && providedFrameHeight
          ? `${providedFrameWidth}x${providedFrameHeight}`
          : 'NOT PROVIDED',
    });

    console.log('📍 Input corners (frame native resolution):', {
      corner0: `${corners[0].x.toFixed(0)}, ${corners[0].y.toFixed(0)}`,
      corner1: `${corners[1].x.toFixed(0)}, ${corners[1].y.toFixed(0)}`,
      corner2: `${corners[2].x.toFixed(0)}, ${corners[2].y.toFixed(0)}`,
      corner3: `${corners[3].x.toFixed(0)}, ${corners[3].y.toFixed(0)}`,
    });

    // Skálázás: corners FROM frameRotated TO photo
    const scaleX = photoWidth / frameRotatedWidth;
    const scaleY = photoHeight / frameRotatedHeight;

    console.log('📐 Scale factors:', {
      scaleX: scaleX.toFixed(4),
      scaleY: scaleY.toFixed(4),
    });

    // Skálázott koordináták
    const scaledCorners = corners.map(c => ({
      x: c.x * scaleX,
      y: c.y * scaleY,
    }));

    console.log('📍 Scaled corners (photo size):', {
      corner0: `${scaledCorners[0].x.toFixed(0)}, ${scaledCorners[0].y.toFixed(
        0,
      )}`,
      corner1: `${scaledCorners[1].x.toFixed(0)}, ${scaledCorners[1].y.toFixed(
        0,
      )}`,
      corner2: `${scaledCorners[2].x.toFixed(0)}, ${scaledCorners[2].y.toFixed(
        0,
      )}`,
      corner3: `${scaledCorners[3].x.toFixed(0)}, ${scaledCorners[3].y.toFixed(
        0,
      )}`,
    });

    // === PERSPECTIVE TRANSFORM: Kivágás a 4 sarok mentén ===
    console.log('✂️ Starting perspective transform with scaled corners');

    // Élek számítása (a scaledCorners alapján, ami már a fotó méretében van)
    const leftEdge = Math.hypot(
      scaledCorners[1].x - scaledCorners[0].x,
      scaledCorners[1].y - scaledCorners[0].y,
    );
    const rightEdge = Math.hypot(
      scaledCorners[2].x - scaledCorners[3].x,
      scaledCorners[2].y - scaledCorners[3].y,
    );
    const topEdge = Math.hypot(
      scaledCorners[3].x - scaledCorners[0].x,
      scaledCorners[3].y - scaledCorners[0].y,
    );
    const bottomEdge = Math.hypot(
      scaledCorners[2].x - scaledCorners[1].x,
      scaledCorners[2].y - scaledCorners[1].y,
    );

    const detectedHeight = Math.round((leftEdge + rightEdge) / 2);
    const detectedWidth = Math.round((topEdge + bottomEdge) / 2);
    const width = detectedWidth;
    const height = detectedHeight;

    console.log('📏 Edge lengths:', {
      leftEdge: leftEdge.toFixed(1),
      rightEdge: rightEdge.toFixed(1),
      topEdge: topEdge.toFixed(1),
      bottomEdge: bottomEdge.toFixed(1),
      avgHeight: detectedHeight,
      avgWidth: detectedWidth,
      aspectRatio: (detectedHeight / detectedWidth).toFixed(2),
    });

    console.log('📐 Detected dimensions:', {
      detectedWidth,
      detectedHeight,
      width,
      height,
    });
    console.log('📍 Corners:', scaledCorners);

    // Perspektíva pontok (scaledCorners használata)
    const srcPoints = OpenCV.createObject(ObjectType.Point2fVector, [
      createPoint2f(scaledCorners[0].x, scaledCorners[0].y),
      createPoint2f(scaledCorners[1].x, scaledCorners[1].y),
      createPoint2f(scaledCorners[2].x, scaledCorners[2].y),
      createPoint2f(scaledCorners[3].x, scaledCorners[3].y),
    ]);
    console.log('✅ srcPoints created');

    const dstPoints = OpenCV.createObject(ObjectType.Point2fVector, [
      createPoint2f(0, 0), // corner 0: topLeft
      createPoint2f(width, 0), // corner 1: topRight
      createPoint2f(width, height), // corner 2: bottomRight
      createPoint2f(0, height), // corner 3: bottomLeft
    ]);
    console.log('✅ dstPoints created');

    const M = OpenCV.invoke('getPerspectiveTransform', srcPoints, dstPoints, 0);
    console.log('✅ Transform matrix created');

    const dstMat = createMat(height, width, DataTypes.CV_8UC3);
    console.log('✅ dstMat created');

    const dstSize = createSize(width, height);
    const borderValue = OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0);
    console.log('✅ Size and border value created');

    OpenCV.invoke(
      'warpPerspective',
      rotatedSrcMat, // Használjuk a FORGATOTT képet!
      dstMat,
      M,
      dstSize,
      1,
      0,
      borderValue,
    );
    console.log('✅ Perspective transform completed');

    // Clone azonnal a stabilitás érdekében (ritka timing issue fix)
    const stableDstMat = OpenCV.invoke('clone', dstMat);
    console.log('✅ Perspective result cloned for stability');

    // Köztes cleanup a memória optimalizálásért
    try {
      // Már nem kellő Mat-ok felszabadítása
    } catch (e) {
      console.warn('Warning cleaning intermediate mats:', e);
    }

    // === 2. TÜKRÖZÉS + FORGATÁS ===
    const flippedMat = createMat(height, width, DataTypes.CV_8UC3);
    OpenCV.invoke('flip', stableDstMat, flippedMat, 1);

    const rotatedMat = createMat(height, width, DataTypes.CV_8UC3);
    OpenCV.invoke('rotate', flippedMat, rotatedMat, 2);

    // Clone a rotated mat is hogy biztosan stabil legyen
    const stableRotatedMat = OpenCV.invoke('clone', rotatedMat);
    console.log('✅ Rotated result cloned for stability');

    // === 3. SCALING ===
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

    // === 4. BRIGHTNESS DETEKTÁLÁS ===
    const grayForMean = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    cvtColorGray(scaledMat, grayForMean);

    const minMaxResult = OpenCV.invoke('minMaxLoc', grayForMean) as any;
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
      avgBrightness > 150
        ? 'Nappali'
        : avgBrightness > 80
        ? 'Normál'
        : 'Éjjeli';

    console.log('💡 Brightness detection:', {
      avgBrightness: avgBrightness.toFixed(1),
      betaBoost,
      lightCondition:
        avgBrightness > 140
          ? 'Nappali'
          : avgBrightness > 100
          ? 'Normál'
          : 'Éjjeli',
    });

    // === 5. FEKETE MASZK (eredeti képről) ===
    const grayForBlack = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC1,
    );
    cvtColorGray(scaledMat, grayForBlack);

    // Threshold: MAGASABB érték hogy a szürke vonalakat is megfogja (nem csak a feketéket)
    const blackMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', grayForBlack, blackMask, 130, 255, 1); // 90-ről 130-ra: szürke vonalakat is megfogja

    // EXTRA VASTAG fekete vonalak: még nagyobb kernelek és több dilate
    const closeKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(11, 11), // 7x7-ről 11x11-re - sokkal nagyobb!
    );
    const closedMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', blackMask, closedMask, 3, closeKernel); // MORPH_CLOSE

    // ÖTSZÖRÖS dilate a VASTAG fekete vonalakért (mint a referencia app)
    const dilateKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(13, 13), // 9x9-ről 13x13-ra! HATALMAS kernel
    );
    const dilated1 = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', closedMask, dilated1, 1, dilateKernel); // 1. dilate

    const dilated2 = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', dilated1, dilated2, 1, dilateKernel); // 2. dilate

    const dilated3 = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', dilated2, dilated3, 1, dilateKernel); // 3. dilate

    const dilated4 = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', dilated3, dilated4, 1, dilateKernel); // 4. dilate

    const blackMaskFinal = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('morphologyEx', dilated4, blackMaskFinal, 1, dilateKernel); // 5. dilate!

    // === 6. SZÍNES MASZK (eredeti képről) ===
    const hsvOriginal = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorBGR2HSV(scaledMat, hsvOriginal);

    const satOriginal = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('extractChannel', hsvOriginal, satOriginal, 1);

    const colorMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', satOriginal, colorMask, 40, 255, 0);

    const colorLayer = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', scaledMat, scaledMat, colorLayer, colorMask);

    // === 7. SZÍNES RÉTEG TÚLSZATURÁLÁSA ===
    const hsvColor = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorBGR2HSV(colorLayer, hsvColor);

    const satColor = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('extractChannel', hsvColor, satColor, 1);

    const superSat = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('convertScaleAbs', satColor, superSat, SUPER_SAT_BOOST, 0);
    OpenCV.invoke('insertChannel', superSat, hsvColor, 1);

    const colorLayerSaturated = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC3,
    );
    cvtColorHSV2BGR(hsvColor, colorLayerSaturated);

    // === 8. BRIGHTNESS BOOST ===
    const brightened = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'convertScaleAbs',
      scaledMat,
      brightened,
      BRIGHTNESS_ALPHA,
      betaBoost,
    );

    // === 9. SHARPENING ===
    const blurred = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'GaussianBlur',
      brightened,
      blurred,
      createSize(0, 0),
      1.0,
      1.0,
      4,
    );

    const sharpened = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'addWeighted',
      brightened,
      1.0 + SHARPEN_AMOUNT,
      blurred,
      -SHARPEN_AMOUNT,
      0,
      sharpened,
    );

    // === 10. SATURATION BOOST ===
    const hsvSharp = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorBGR2HSV(sharpened, hsvSharp);

    const satSharp = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('extractChannel', hsvSharp, satSharp, 1);

    const boostedSat = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('convertScaleAbs', satSharp, boostedSat, SAT_BOOST, 0);
    OpenCV.invoke('insertChannel', boostedSat, hsvSharp, 1);

    const colorBoosted = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC3,
    );
    cvtColorHSV2BGR(hsvSharp, colorBoosted);

    // === 11. FINAL BRIGHTNESS BUMP ===
    const finalBrightened = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC3,
    );
    const finalBeta = Math.round(betaBoost * 0.5);
    OpenCV.invoke(
      'convertScaleAbs',
      colorBoosted,
      finalBrightened,
      FINAL_BRIGHTNESS_ALPHA,
      finalBeta,
    );

    // === 12. WHITE MASK ===
    const grayFinal = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    cvtColorGray(finalBrightened, grayFinal);

    const whiteMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', grayFinal, whiteMask, 200, 255, 0);

    // === 13. 3 RÉTEG KOMBINÁCIÓ ===
    // A blackLayer legyen FEKETE ahol a maszk aktív, hogy erős vonalak legyenek
    const blackLayer = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', finalBrightened, blackLayer, 0, 0); // Vissza a fekete layer-hez

    const whiteLayer = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', finalBrightened, whiteLayer, 0, 255);

    // Maskok 3 csatornára
    const blackMask3ch = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC3,
    );
    const whiteMask3ch = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC3,
    );
    const colorMask3ch = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC3,
    );

    cvtColorGray2BGR(blackMaskFinal, blackMask3ch);
    cvtColorGray2BGR(whiteMask, whiteMask3ch);
    cvtColorGray2BGR(colorMask, colorMask3ch);

    // Apply masks
    const blackPart = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    const whitePart = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    const colorPart = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);

    OpenCV.invoke('bitwise_and', blackLayer, blackMask3ch, blackPart);
    OpenCV.invoke('bitwise_and', whiteLayer, whiteMask3ch, whitePart);
    OpenCV.invoke('bitwise_and', colorLayerSaturated, colorMask3ch, colorPart);

    // Combine
    const temp = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', blackPart, whitePart, temp);

    const combined = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', temp, colorPart, combined);

    // === 14. PROFESSIONAL SCAN ===
    const scanMat = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'convertScaleAbs',
      combined,
      scanMat,
      SCAN_CONTRAST_ALPHA,
      SCAN_BRIGHTNESS_BETA,
    );

    // === 15. CROP ===
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
    OpenCV.invoke('crop', scanMat, croppedMat, cropRect);

    // === 15.5. ALSÓ SÖTÉT KERET HOZZÁADÁSA ===
    // ARÁNYOS borderSize a kép magasságához képest (5-8% jó arány)
    const borderSize = Math.max(40, Math.round(cropHeight * 0.06)); // Min 40px, de inkább 6% a magasságból
    console.log(
      `📏 Border size: ${borderSize}px (${(
        (borderSize / cropHeight) *
        100
      ).toFixed(1)}% of height)`,
    );

    // === QR KÓD ALAPÚ IKON POZÍCIONÁLÁS ===
    // A QR kód bounds koordinátái frame koordinátákban vannak (pl. 640x480)
    // Ezeket át kell skálázni a photo méretére (pl. 960x1280 rotált után)
    const qrOnLeft = params.currentQrPosition === 'left';
    console.log(
      `🔲 QR Position from camera: ${
        params.currentQrPosition ?? 'unknown'
      } => QR on ${qrOnLeft ? 'LEFT' : 'RIGHT'}`,
    );

    let borderLeftPadding: number;
    let borderWidth: number;

    if (params.qrBounds && providedFrameWidth && providedFrameHeight) {
      // Van QR bounds! Pontosan tudjuk hol van a QR kód
      const qrBounds = params.qrBounds;

      // A frame forgatva van 90°-kal, ezért:
      // frame.left -> photo.top (Y koordináta)
      // frame.top -> photo.left (X koordináta, de invertálva)
      // frame.width -> photo.height
      // frame.height -> photo.width

      // FONTOS: A scaleX és scaleY már definiálva van feljebb (188-189 sorok)!
      // scaleX = photoWidth / frameRotatedWidth
      // scaleY = photoHeight / frameRotatedHeight

      // QR kód pozíciója a rotált fotón (perspective transform UTÁN)
      // A perspective transform megváltoztatja a méretet, ezért használjuk a cropWidth/cropHeight arányt
      const qrPhotoLeft = qrBounds.left * scaleX;
      const qrPhotoWidth = qrBounds.width * scaleX;

      console.log(
        `📍 QR Bounds (frame): left=${qrBounds.left}, width=${qrBounds.width}`,
      );
      console.log(
        `📍 QR Bounds (photo scaled): left=${qrPhotoLeft.toFixed(
          0,
        )}, width=${qrPhotoWidth.toFixed(0)}`,
      );

      // Ikon sáv szélessége: kb. 70-75% a teljes szélességből
      borderWidth = Math.floor(cropWidth * 0.75);

      // QR kód pozíció alapján: bal oldalt középen, jobb oldalt balrább
      const centerPadding = Math.floor((cropWidth - borderWidth) / 2);

      if (qrOnLeft) {
        // QR bal oldalt → középre (ez működik!)
        borderLeftPadding = centerPadding + 10;
      } else {
        // QR jobb oldalt → BALRÁBB tolni (10% offset)
        const fingerOffset = Math.round(cropWidth * 0.04);
        borderLeftPadding = centerPadding - fingerOffset - 10;
      }

      console.log(
        `📐 Icon strip: left=${borderLeftPadding}, width=${borderWidth} (QR ${
          qrOnLeft ? 'LEFT (centered)' : 'RIGHT (shifted left)'
        })`,
      );
    } else {
      // Nincs QR bounds - fallback a régi móds zerre
      console.log(`⚠️ No QR bounds available, using fallback positioning`);
      const borderWidthPercent = 0.75; // 75% szélesség
      borderWidth = Math.floor(cropWidth * borderWidthPercent);
      borderLeftPadding = qrOnLeft
        ? Math.floor((cropWidth - borderWidth) / 2) + 10 // QR bal oldalt -> ikonok jobbra
        : Math.floor((cropWidth - borderWidth) / 2) - 50; // QR jobb oldalt -> ikonok balra
    }

    // Felső rész (változatlan)
    const topHeight = cropHeight - borderSize;
    const topRect = OpenCV.createObject(
      ObjectType.Rect,
      0,
      0,
      cropWidth,
      topHeight,
    );
    const topPart = createMat(topHeight, cropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('crop', croppedMat, topPart, topRect);

    // Alsó rész bal és jobb oldala (változatlan)
    const borderRightPadding = cropWidth - borderLeftPadding - borderWidth;
    const bottomLeftRect = OpenCV.createObject(
      ObjectType.Rect,
      0,
      cropHeight - borderSize,
      borderLeftPadding,
      borderSize,
    );
    const bottomLeft = createMat(
      borderSize,
      borderLeftPadding,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('crop', croppedMat, bottomLeft, bottomLeftRect);

    const bottomRightRect = OpenCV.createObject(
      ObjectType.Rect,
      borderLeftPadding + borderWidth,
      cropHeight - borderSize,
      borderRightPadding,
      borderSize,
    );
    const bottomRight = createMat(
      borderSize,
      borderRightPadding,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('crop', croppedMat, bottomRight, bottomRightRect);

    // Középső rész 8 egyenlő részre osztása
    const numSegments = 8;
    const segmentWidth = Math.floor(borderWidth / numSegments);
    const segments: any[] = [];
    const iconAnalysis: { segment: number; darkPixelRatio: number }[] = [];

    for (let i = 0; i < numSegments; i++) {
      const isLast = i === numSegments - 1;
      const segWidth = isLast
        ? borderWidth - segmentWidth * (numSegments - 1)
        : segmentWidth;
      const segX = borderLeftPadding + i * segmentWidth;

      // Kivágás
      const segRect = OpenCV.createObject(
        ObjectType.Rect,
        segX,
        cropHeight - borderSize,
        segWidth,
        borderSize,
      );
      const segment = createMat(borderSize, segWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('crop', croppedMat, segment, segRect);

      // === IKON DETEKTÁLÁS: Sötét pixelek számítása ===
      // Szürkeárnyalatossá alakítás
      const graySegment = createMat(borderSize, segWidth, DataTypes.CV_8UC1);
      cvtColorGray(segment, graySegment);

      // Threshold: sötét pixelek detektálása (pl. < 100 érték = sötét)
      const darkMask = createMat(borderSize, segWidth, DataTypes.CV_8UC1);
      OpenCV.invoke('threshold', graySegment, darkMask, 100, 255, 1); // THRESH_BINARY_INV

      // Sötét pixelek aránya (countNonZero)
      const darkPixelCountResult = OpenCV.invoke(
        'countNonZero',
        darkMask,
      ) as any;
      const darkPixelCount =
        darkPixelCountResult?.value ?? darkPixelCountResult ?? 0;
      const totalPixels = borderSize * segWidth;
      const darkPixelRatio = darkPixelCount / totalPixels;

      console.log(
        `🔍 Segment ${i}: ${(darkPixelRatio * 100).toFixed(2)}% dark pixels`,
      );

      iconAnalysis.push({
        segment: i,
        darkPixelRatio: darkPixelRatio,
      });

      // Ne színezzük át, használjuk az eredeti szegmenst
      const finalSeg = segment;

      if (darkPixelRatio > 0.03) {
        console.log(
          `⬛ Segment ${i} detected as CHECKED (${(
            darkPixelRatio * 100
          ).toFixed(2)}% dark pixels)`,
        );
      } else {
        console.log(
          `⬜ Segment ${i} detected as UNCHECKED (${(
            darkPixelRatio * 100
          ).toFixed(2)}% dark pixels)`,
        );
      }

      segments.push({ mat: finalSeg, width: segWidth });
    }

    // Gyűjtsük össze az ÖSSZES kiválasztott ikont (ahol ≥3% sötét pixel van)
    const selectedIcons: number[] = [];
    const threshold = 0.005; // 3% minimum - egyező a színezéssel!

    for (let i = 0; i < iconAnalysis.length; i++) {
      if (iconAnalysis[i].darkPixelRatio >= threshold) {
        selectedIcons.push(i);
      }
    }

    console.log(`✅ Selected icons: [${selectedIcons.join(', ')}]`);

    // Szegmensek összeállítása vízszintesen
    // Első szegmens
    let currentRow = segments[0].mat;
    let currentWidth = segments[0].width;

    // Hozzáadjuk a többi szegmenst jobbra
    for (let i = 1; i < numSegments; i++) {
      const nextSegment = segments[i];
      const newWidth = currentWidth + nextSegment.width;
      const combinedRow = createMat(borderSize, newWidth, DataTypes.CV_8UC3);

      // Bal oldal: currentRow
      const leftPadded = createMat(borderSize, newWidth, DataTypes.CV_8UC3);
      OpenCV.invoke(
        'copyMakeBorder',
        currentRow,
        leftPadded,
        0,
        0,
        0,
        nextSegment.width,
        0,
        OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0),
      );

      // Jobb oldal: nextSegment
      const rightPadded = createMat(borderSize, newWidth, DataTypes.CV_8UC3);
      OpenCV.invoke(
        'copyMakeBorder',
        nextSegment.mat,
        rightPadded,
        0,
        0,
        currentWidth,
        0,
        0,
        OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0),
      );

      // Összeadás
      OpenCV.invoke('add', leftPadded, rightPadded, combinedRow);
      currentRow = combinedRow;
      currentWidth = newWidth;
    }

    // Most currentRow tartalmazza a teljes középső részt (8 szegmens)
    const bottomCenterWithGradient = currentRow;

    // Teljes alsó sor összeállítása: bal padding + középső (8 szegmens) + jobb padding
    // Középső rész paddingelt verziója (ez lesz az alap)
    let completeBottomRow = createMat(borderSize, cropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'copyMakeBorder',
      bottomCenterWithGradient,
      completeBottomRow,
      0,
      0,
      borderLeftPadding,
      borderRightPadding,
      0,
      OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0),
    );

    // Bal oldal hozzáadása (ha van) - felülírjuk a bal padding részt
    if (borderLeftPadding > 0) {
      const leftPadded = createMat(borderSize, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke(
        'copyMakeBorder',
        bottomLeft,
        leftPadded,
        0,
        0,
        0,
        cropWidth - borderLeftPadding,
        0,
        OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0),
      );
      const tempBottom1 = createMat(borderSize, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('add', completeBottomRow, leftPadded, tempBottom1);
      completeBottomRow = tempBottom1;
    }

    // Jobb oldal hozzáadása (ha van) - felülírjuk a jobb padding részt
    if (borderRightPadding > 0) {
      const rightPadded = createMat(borderSize, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke(
        'copyMakeBorder',
        bottomRight,
        rightPadded,
        0,
        0,
        borderLeftPadding + borderWidth,
        0,
        0,
        OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0),
      );
      const tempBottom2 = createMat(borderSize, cropWidth, DataTypes.CV_8UC3);
      OpenCV.invoke('add', completeBottomRow, rightPadded, tempBottom2);
      completeBottomRow = tempBottom2;
    }

    // Összefűzés: felső rész + teljes alsó sor vertikálisan
    const finalResult = createMat(cropHeight, cropWidth, DataTypes.CV_8UC3);

    // Felső rész hozzáadása
    const topPadded = createMat(cropHeight, cropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'copyMakeBorder',
      topPart,
      topPadded,
      0,
      borderSize,
      0,
      0,
      0,
      OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0),
    );

    // Alsó sor hozzáadása
    const bottomPadded = createMat(cropHeight, cropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'copyMakeBorder',
      completeBottomRow,
      bottomPadded,
      topHeight,
      0,
      0,
      0,
      0,
      OpenCV.createObject(ObjectType.Scalar, 0, 0, 0, 0),
    );

    // Végső összeadás
    OpenCV.invoke('add', topPadded, bottomPadded, finalResult);

    // === DEBUG: Piros keret az ikon sávra (a VÉGSŐ képen) - CSAK 1-7 szegmensek ===
    console.log(
      `🔴 DEBUG: Drawing RED rectangle for segments 1-7 only (skipping segment 0)`,
    );

    const redColor = OpenCV.createObject(ObjectType.Scalar, 0, 0, 255); // BGR: piros

    // Keret CSAK az 1-7 szegmensekre (0. szegmens kihagyása)
    const segment1StartX = borderLeftPadding + segmentWidth; // 1. szegmens kezdete
    const segments17Width = borderWidth - segmentWidth; // 7 szegmens szélessége

    // Felső vonal (csak 1-7)
    const topLineStart = OpenCV.createObject(
      ObjectType.Point,
      segment1StartX,
      cropHeight - borderSize,
    );
    const topLineEnd = OpenCV.createObject(
      ObjectType.Point,
      segment1StartX + segments17Width,
      cropHeight - borderSize,
    );
    OpenCV.invoke(
      'line',
      finalResult,
      topLineStart,
      topLineEnd,
      redColor,
      6,
      8,
    );

    // Alsó vonal (csak 1-7)
    const bottomLineStart = OpenCV.createObject(
      ObjectType.Point,
      segment1StartX,
      cropHeight - 1,
    );
    const bottomLineEnd = OpenCV.createObject(
      ObjectType.Point,
      segment1StartX + segments17Width,
      cropHeight - 1,
    );
    OpenCV.invoke(
      'line',
      finalResult,
      bottomLineStart,
      bottomLineEnd,
      redColor,
      6,
      8,
    );

    // Bal vonal (1. szegmens bal oldala)
    const leftLineStart = OpenCV.createObject(
      ObjectType.Point,
      segment1StartX,
      cropHeight - borderSize,
    );
    const leftLineEnd = OpenCV.createObject(
      ObjectType.Point,
      segment1StartX,
      cropHeight,
    );
    OpenCV.invoke(
      'line',
      finalResult,
      leftLineStart,
      leftLineEnd,
      redColor,
      6,
      8,
    );

    // Jobb vonal (7. szegmens jobb oldala)
    const rightLineStart = OpenCV.createObject(
      ObjectType.Point,
      segment1StartX + segments17Width,
      cropHeight - borderSize,
    );
    const rightLineEnd = OpenCV.createObject(
      ObjectType.Point,
      segment1StartX + segments17Width,
      cropHeight,
    );
    OpenCV.invoke(
      'line',
      finalResult,
      rightLineStart,
      rightLineEnd,
      redColor,
      6,
      8,
    );

    // Szegmens választóvonalak (csak 1-7 között, tehát 2,3,4,5,6,7 elején)
    for (let i = 2; i <= 7; i++) {
      const dividerX = borderLeftPadding + i * segmentWidth;
      const dividerStart = OpenCV.createObject(
        ObjectType.Point,
        dividerX,
        cropHeight - borderSize,
      );
      const dividerEnd = OpenCV.createObject(
        ObjectType.Point,
        dividerX,
        cropHeight,
      );
      OpenCV.invoke(
        'line',
        finalResult,
        dividerStart,
        dividerEnd,
        redColor,
        3,
        8,
      );
    }

    // === 16. FEKETE SZÉL DETEKTÁLÁS (egyszerűsített) ===
    // A perspective transform gyakran hagy fekete széleket, ezt automatikusan levágjuk
    const autoDetectBlackBorders = () => {
      'worklet';
      
      // Egyszerű heurisztika: ha perspective transform volt, 
      // általában 1-3% fekete szél marad a szélek körül
      const borderPercent = 0.015; // 1.5% minden oldalról
      
      return {
        topCrop: Math.round(cropHeight * borderPercent),
        bottomCrop: Math.round(cropHeight * borderPercent), 
        leftCrop: Math.round(cropWidth * borderPercent),
        rightCrop: Math.round(cropWidth * borderPercent)
      };
    };
    
    const borderCrops = autoDetectBlackBorders();
    console.log(`🖤 Auto black border removal:`, borderCrops);

    // === 17. FINAL CROP: Alsó 8% + fekete szél levágása ===
    const finalBottomCrop = Math.max(
      Math.round(cropHeight * 0.08), // 8% alulról minimum
      borderCrops.bottomCrop // vagy fekete szél
    );
    const finalTopCrop = borderCrops.topCrop;
    const finalLeftCrop = borderCrops.leftCrop;
    const finalRightCrop = borderCrops.rightCrop;
    
    const finalCropHeight = cropHeight - finalTopCrop - finalBottomCrop;
    const finalCropWidth = cropWidth - finalLeftCrop - finalRightCrop;

    console.log(
      `✂️ Final crop: top=${finalTopCrop}, bottom=${finalBottomCrop}, left=${finalLeftCrop}, right=${finalRightCrop}`,
    );
    console.log(
      `✂️ Final size: ${finalCropWidth}x${finalCropHeight} (from ${cropWidth}x${cropHeight})`,
    );

    const finalCropRect = OpenCV.createObject(
      ObjectType.Rect,
      finalLeftCrop, // left offset
      finalTopCrop, // top offset  
      finalCropWidth, // width after crop
      finalCropHeight, // height after crop
    );

    const finalCroppedResult = createMat(
      finalCropHeight,
      finalCropWidth,
      DataTypes.CV_8UC3,
    );
    OpenCV.invoke('crop', finalResult, finalCroppedResult, finalCropRect);

    // === 17. BASE64 KONVERZIÓ ===
    const result = OpenCV.toJSValue(finalCroppedResult);

    if (!result?.base64) {
      throw new Error('Failed to convert scanned image to base64');
    }

    // Ikon nevek meghatározása
    const selectedIconNames = selectedIcons.map(
      index => ICON_NAMES[index] || '',
    );

    console.log(
      `📋 Detektált ikonok: ${
        selectedIcons.length > 0
          ? selectedIcons
              .map((idx, i) => `${idx}-${selectedIconNames[i]}`)
              .join(', ')
          : 'nincs'
      }`,
    );

    return {
      success: true,
      imageBase64: result.base64,
      brightnessInfo: {
        avgBrightness: Math.round(avgBrightness),
        lightCondition,
        betaBoost,
      },
      selectedIcons,
      selectedIconNames,
      iconAnalysis,
    };
  } catch (error) {
    console.error('Scan error:', error);
    // Memory cleanup ASAP hibák esetén is
    try {
      OpenCV.clearBuffers();
      console.log('🧹 Early OpenCV cleanup on error');
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Tisztítsuk meg az OpenCV buffer-t fotózás után
    try {
      OpenCV.clearBuffers();
      console.log('🧹 OpenCV buffers cleared after scan');
    } catch (clearError) {
      console.error('Error clearing OpenCV buffers:', clearError);
    }
  }
};
