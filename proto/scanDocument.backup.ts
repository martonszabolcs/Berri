import { Alert } from 'react-native';
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
// ============= KONSTANSOK (magyarázat lent) =============
// SCALE_FACTOR: A perspektíva transzformált kép méretezési aránya (1.0 = eredeti méret)
const SCALE_FACTOR = 1.0;
// CROP_PERCENT: A kép széleiből levágandó arány (0.01 = 1% minden oldalról)
const CROP_PERCENT = 0.01;
// SHARPEN_AMOUNT: Élesség növelésének mértéke (minél nagyobb, annál élesebb lesz a kép)
const SHARPEN_AMOUNT = 1.8;
// SAT_BOOST: Színtelítettség növelésének mértéke (1.5 = 50%-kal telítettebb színek)
const SAT_BOOST = 1.5;
// SUPER_SAT_BOOST: Extra színtelítettség a színes rétegre (2.0 = duplázott telítettség)
const SUPER_SAT_BOOST = 2.0;
// BRIGHTNESS_ALPHA: Fényerő növelésének szorzója (1.2 = 20%-kal világosabb kép)
const BRIGHTNESS_ALPHA = 1.2;
// FINAL_BRIGHTNESS_ALPHA: Utolsó fényerő finomhangolás (1.08 = 8%-kal világosabb)
const FINAL_BRIGHTNESS_ALPHA = 1.08;
// SCAN_CONTRAST_ALPHA: Szkennelés utáni kontraszt erősítés (1.3 = 30%-kal nagyobb kontraszt)
const SCAN_CONTRAST_ALPHA = 1.3;
// SCAN_BRIGHTNESS_BETA: Szkennelés utáni fényerő eltolás (5 = +5 fényerő minden pixelhez)
const SCAN_BRIGHTNESS_BETA = 5;

// Ikon nevek
const ICON_NAMES = [
  '', // 0
  'cseresznye', // 1
  'ananász', // 2
  'alma', // 3
  'banán', // 4
  'citrom', // 5
  'dinnye', // 6
  'szőlő', // 7
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

    // === 3.5. BLUR ELLENŐRZÉS (FINAL CHECK) ===
    console.log('🔍 Checking image sharpness before processing...');
    const grayForBlurCheck = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    cvtColorGray(scaledMat, grayForBlurCheck);
    
    // Laplacian variance számítás
    const laplacianBlurCheck = createMat(scaledHeight, scaledWidth, DataTypes.CV_64F);
    OpenCV.invoke('Laplacian', grayForBlurCheck, laplacianBlurCheck, DataTypes.CV_64F, 1, 1, 0, 4);
    
    const absLaplacianCheck = createMat(scaledHeight, scaledWidth, DataTypes.CV_64F);
    OpenCV.invoke('convertScaleAbs', laplacianBlurCheck, absLaplacianCheck, 1, 0);
    
    const varianceScalarCheck = OpenCV.invoke('mean', absLaplacianCheck);
    const varianceDataCheck = OpenCV.toJSValue(varianceScalarCheck);
    const finalVariance = varianceDataCheck.a || 0;
    
    console.log('📊 Final blur check:', {
      variance: finalVariance.toFixed(2),
      threshold: 2,
      isSharp: finalVariance >= 2,
    });
    
    // Ha túl homályos a kép, ne processzáljuk
    if (finalVariance < 2) {
      Alert.alert('Hiba', `Kép túl homályos. Próbáld újra!`);
      console.error('❌ Image too blurry, aborting scan. Variance:', finalVariance.toFixed(2));
      return {
        success: false,
        error: `Kép túl homályos (élesség: ${finalVariance.toFixed(1)}, minimum: 3.0). Próbáld újra!`,
      };
    }
    
    console.log('✅ Image sharpness OK, continuing with processing');

    // === 4. VONALVEZETŐK ELTÁVOLÍTÁSA (pöttyös vonalak) ===
    console.log('🧹 Removing guide dots/lines...');
    
    // Készítsünk gray verziót a vonalvezető detektáláshoz
    const grayForGuides = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    cvtColorGray(scaledMat, grayForGuides);
    
    // 1. STRATÉGIA: Detektáljuk a VILÁGOS SZÜRKE pöttyöket/vonalakat (140-200 tartomány)
    // Ezek a vonalvezetők általában 160-180 körüli brightness-szel rendelkeznek
    // A szöveg/ceruzavonal sokkal sötétebb (60-120)
    
    // Készítsünk egy maszkot ami CSAK a vonalvezetőket fogja meg
    const guideMaskLower = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    const guideMaskUpper = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    
    // Lower threshold: minden ami SÖTÉTEBB mint 140 → fehér maszk (nem vonalvezető)
    OpenCV.invoke('threshold', grayForGuides, guideMaskLower, 140, 255, 1); // THRESH_BINARY_INV
    
    // Upper threshold: minden ami VILÁGOSABB mint 200 → fehér maszk (túl világos, nem vonalvezető)
    OpenCV.invoke('threshold', grayForGuides, guideMaskUpper, 200, 255, 0); // THRESH_BINARY
    
    // Kombináljuk: 140-200 tartományban van → fekete maszk (vonalvezető)
    const guideMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', guideMaskLower, guideMask); // Invertáljuk: vonalvezetők feketék
    OpenCV.invoke('bitwise_and', guideMask, guideMaskUpper, guideMask); // ÉS művelet: csak 140-200 tartomány
    
    // 2. MORFOLÓGIAI TISZTÍTÁS: Kis pontok/vonalak eltávolítása (CSAK kis dolgok!)
    // Opening művelet: kis objektumok eltűnnek, nagy dolgok (szöveg) megmaradnak
    const openKernel = OpenCV.invoke(
      'getStructuringElement',
      0, // MORPH_RECT
      createSize(3, 3), // Kis kernel: csak apró pöttyök/vonalak szűnnek meg
    );
    const openedGuideMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', guideMask, openedGuideMask, 2, openKernel); // MORPH_OPEN
    
    // 3. DILATE: Kicsit nagyobbra növeljük a maszkot hogy biztosan lefedjen minden vonalvezetőt
    const dilateGuideKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(5, 5), // Kicsit nagyobb kernel
    );
    const dilatedGuideMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', openedGuideMask, dilatedGuideMask, 1, dilateGuideKernel); // MORPH_DILATE
    
    // 4. FEHÉRÍTÉS: Ahol vonalvezető van, ott fehér legyen
    const guideMask3ch = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(dilatedGuideMask, guideMask3ch);
    
    // Fehér overlay készítése
    const whiteForGuides = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', scaledMat, whiteForGuides, 0, 255); // Tiszta fehér
    
    // Fehérítés CSAK ahol vonalvezető van
    const whiteGuides = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', whiteForGuides, guideMask3ch, whiteGuides);
    
    // Invertált maszk: ahol NINCS vonalvezető
    const noGuideMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', dilatedGuideMask, noGuideMask);
    const noGuideMask3ch = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(noGuideMask, noGuideMask3ch);
    
    // Eredeti kép vonalvezetők nélkül
    const withoutGuides = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', scaledMat, noGuideMask3ch, withoutGuides);
    
    // VÉGSŐ kombináció: eredeti + fehér vonalvezetők helyén
    const cleanedScaledMat = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', withoutGuides, whiteGuides, cleanedScaledMat);
    
    console.log('✅ Guide dots/lines removed');

    // === 5. BRIGHTNESS DETEKTÁLÁS ===
    const grayForMean = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    cvtColorGray(cleanedScaledMat, grayForMean); // MOST MÁR A TISZTÍTOTT KÉPET használjuk!

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

    // === 6. HÁTTÉR FEHÉRÍTÉS - CSAK SÖTÉT TARTALOM MEGŐRZÉSE ===
    // Maszkoljuk ki a sötét dolgokat (szöveg, rajz) és a többi legyen fehér (pöttyök eltűnnek)
    console.log('🧹 Masking dark content and whitening background...');
    
    // ADAPTÍV THRESHOLD - vakuval SOKKAL magasabb kell!
    // Nagyon világos (vaku, >160): csak a LEGFEKETÉBB tartalom marad (165+)
    // Világos (140-160): közepes agresszivitás (145)
    // Közepes (110-140): normál (125)
    // Sötét (<110): megengedő (110)
    const contentThreshold = 
      avgBrightness > 160 ? 170 : 
      avgBrightness > 140 ? 150 : 
      avgBrightness > 110 ? 125 : 110;
    
    console.log(`📐 Content threshold: ${contentThreshold} (brightness: ${avgBrightness})`);
    
    // Készítsünk gray verziót
    const grayForContent = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    cvtColorGray(cleanedScaledMat, grayForContent);
    
    // Threshold: minden ami SÖTÉTEBB mint threshold, azt megtartjuk (szöveg, rajz, ceruzavonalak)
    // Minden ami világosabb mint threshold, azt fehérre cseréljük (pöttyök, háttér, foltok)
    const darkContentMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', grayForContent, darkContentMask, contentThreshold, 255, 1); // THRESH_BINARY_INV: threshold alatt = fehér (255)
    
    // Kis dilate hogy a vékony vonalak ne szakadozzanak
    const contentKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(2, 2),
    );
    const contentMaskDilated = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', darkContentMask, contentMaskDilated, 1, contentKernel); // DILATE
    
    // Konvertáljuk 3 csatornássá
    const contentMask3ch = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(contentMaskDilated, contentMask3ch);
    
    // Másoljuk ki CSAK a sötét tartalmakat
    const darkContentOnly = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', cleanedScaledMat, contentMask3ch, darkContentOnly);
    
    // Készítsünk egy teljesen FEHÉR hátteret
    const whiteBackground = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', cleanedScaledMat, whiteBackground, 0, 255); // 0*x + 255 = fehér
    
    // Invertáljuk a maszkot: ahol NEM volt tartalom
    const backgroundMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', contentMaskDilated, backgroundMask);
    const backgroundMask3ch = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(backgroundMask, backgroundMask3ch);
    
    // Fehér háttér CSAK ahol nincs tartalom
    const whiteBackgroundOnly = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', whiteBackground, backgroundMask3ch, whiteBackgroundOnly);
    
    // Kombináljuk: sötét tartalom + fehér háttér
    const cleanScaledMat = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', darkContentOnly, whiteBackgroundOnly, cleanScaledMat);
    
    console.log('✅ Background whitened, dark content preserved');

    // === 7. FEKETE MASZK (eredeti képről) ===
    const grayForBlack = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC1,
    );
    cvtColorGray(cleanScaledMat, grayForBlack); // Most már a tisztított képet használjuk!

    // ADAPTÍV THRESHOLD - vakuval SOKKAL magasabb kell!
    const blackThreshold = 
      avgBrightness > 160 ? 210 : 
      avgBrightness > 140 ? 195 : 
      avgBrightness > 110 ? 185 : 180;
    
    console.log(`📐 Black mask threshold: ${blackThreshold} (brightness: ${avgBrightness})`);
    
    // Threshold: MAGASABB érték hogy a szürke vonalakat is megfogja (nem csak a feketéket)
    const blackMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', grayForBlack, blackMask, blackThreshold, 255, 1);

    // ULTRA VASTAG fekete vonalak: hatalmas kernelek és még több dilate (RB referencia alapján)
    const closeKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(15, 15), // 11x11-ről 15x15-re - HATALMAS!
    );
    const closedMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', blackMask, closedMask, 3, closeKernel); // MORPH_CLOSE

    // EXTRA ÖSSZEKÖTŐ LÉPÉS: nagyobb CLOSE kernel a szakadozott vonalak összekötéséhez
    const extraCloseKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(21, 21), // Nagy kernel a távolabb lévő fekete részek összekötéséhez
    );
    const extraClosed = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', closedMask, extraClosed, 3, extraCloseKernel); // EXTRA MORPH_CLOSE

    // NÉGYES dilate NAGYOBB kernellel a vastagabb vonalakért
    const dilateKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(17, 17), // Nagyobb kernel = vastagabb vonalak (13-ról 17-re)
    );
    const dilated1 = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', extraClosed, dilated1, 1, dilateKernel); // 1. dilate

    const dilated2 = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', dilated1, dilated2, 1, dilateKernel); // 2. dilate

    const dilated3 = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', dilated2, dilated3, 1, dilateKernel); // 3. dilate

    const blackMaskFinal = createMat(
      scaledHeight,
      scaledWidth,
      DataTypes.CV_8UC1,
    );
    OpenCV.invoke('morphologyEx', dilated3, blackMaskFinal, 1, dilateKernel); // 4. dilate!

    // === 8. SZÍNES MASZK (eredeti képről) ===
    const hsvOriginal = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorBGR2HSV(cleanedScaledMat, hsvOriginal);

    const satOriginal = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('extractChannel', hsvOriginal, satOriginal, 1);

    const colorMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', satOriginal, colorMask, 40, 255, 0);

    const colorLayer = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', cleanedScaledMat, cleanedScaledMat, colorLayer, colorMask);

    // === 9. SZÍNES RÉTEG TÚLSZATURÁLÁSA ===
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

    // === 10. BRIGHTNESS BOOST ===
    const brightened = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'convertScaleAbs',
      cleanedScaledMat,
      brightened,
      BRIGHTNESS_ALPHA,
      betaBoost,
    );

    // === 11. SHARPENING ===
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

    // === 12. SATURATION BOOST ===
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

    // === 13. FINAL BRIGHTNESS BUMP ===
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

        // === 14. EXTRA VONALTELÍTÉSI ALGORITMUS ===
    // A vékony/halvány vonalak telítése a fekete maszk alapján
    const enhancedGray = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    cvtColorGray(cleanedScaledMat, enhancedGray);
    
    // Adaptív threshold a vékony vonalak jobb detektálásához
    const adaptiveThresh = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('adaptiveThreshold', enhancedGray, adaptiveThresh, 255, 1, 1, 11, 10);
    
    // Kombinálás a fekete maszkkal - a vékony vonalakat is sötétíti
    const enhancedBlackMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_or', blackMaskFinal, adaptiveThresh, enhancedBlackMask);
    
    // DUPLA DILATE STEP az enhanced maszkra - még vastagabb vonalak
    const finalEnhanceKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(13, 13), // Nagyobb kernel (9-ről 13-ra)
    );
    const tempFinalMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', enhancedBlackMask, tempFinalMask, 1, finalEnhanceKernel); // 1. final dilate
    
    const finalBlackMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', tempFinalMask, finalBlackMask, 1, finalEnhanceKernel); // 2. final dilate

    // === 15. MASZKOK ALKALMAZÁSA ===
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

    cvtColorGray2BGR(finalBlackMask, blackMask3ch);
    cvtColorGray2BGR(whiteMask, whiteMask3ch);
    cvtColorGray2BGR(colorMask, colorMask3ch);

    // Apply masks
    const blackPart = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    const whitePart = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    const colorPart = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);

    // Apply enhanced black mask to strengthen lines
    const enhancedBlackPart = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', blackLayer, blackMask3ch, enhancedBlackPart);
    
    // Strengthen line intensity (növelt erősítés a vastagabb, feketébb vonalakért)
    OpenCV.invoke('convertScaleAbs', enhancedBlackPart, blackPart, 1.3, -10);
    OpenCV.invoke('bitwise_and', whiteLayer, whiteMask3ch, whitePart);
    OpenCV.invoke('bitwise_and', colorLayerSaturated, colorMask3ch, colorPart);

    // Combine
    const temp = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', blackPart, whitePart, temp);

    const combined = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', temp, colorPart, combined);

    // VONALVEZETŐK MÁR EL VANNAK TÁVOLÍTVA A KORAI FÁZISBAN (5-ös szekció)
    // Ezt a szekciót (13.5) kihagyjuk, használjuk a cleanScaledMat-ot
    const cleanedCombined = combined; // A combined már tiszta, mert a cleanScaledMat-ból jött

    // === 17. SZÜRKE FOLTOK FEHÉRÍTÉSE ===
    console.log('⚪ Whitening gray spots...');
    
    // Detektáljuk a VILÁGOS SZÜRKE területeket (180-240 tartomány)
    const grayForSpots = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    cvtColorGray(cleanedCombined, grayForSpots);
    
    // Threshold: világos szürke foltok (180-240) - ezeket fehérítjük
    const graySpotsMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', grayForSpots, graySpotsMask, 180, 255, 0); // Minden 180 feletti -> fehér maszk
    
    // Invertáljuk: ahol VILÁGOS SZÜRKE van (180 alatt), ott legyen fehér a maszkban
    const lightGrayMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', graySpotsMask, lightGrayMask);
    
    // De csak azokat fehérítjük, amik NEM túl sötétek (> 140 threshold)
    const notTooDarkMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', grayForSpots, notTooDarkMask, 140, 255, 0); // 140 felett -> tartjuk
    
    // Kombináció: világos szürke ÉS nem túl sötét = fehérítendő
    const finalGraySpotsMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_and', lightGrayMask, notTooDarkMask, finalGraySpotsMask);
    
    // Kis morfológia cleanup a zajra
    const cleanupKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(3, 3),
    );
    const cleanedSpotsMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', finalGraySpotsMask, cleanedSpotsMask, 2, cleanupKernel); // MORPH_OPEN
    
    // Maszk 3 csatornára
    const graySpotsMask3ch = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(cleanedSpotsMask, graySpotsMask3ch);
    
    // Invertált maszk
    const invertedSpotsMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', cleanedSpotsMask, invertedSpotsMask);
    const invertedSpotsMask3ch = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(invertedSpotsMask, invertedSpotsMask3ch);
    
    // Kép szürke foltok nélkül
    const withoutGraySpots = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', cleanedCombined, invertedSpotsMask3ch, withoutGraySpots);
    
    // Fehér overlay a szürke foltokra
    const whiteForSpots = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', cleanedCombined, whiteForSpots, 0, 255); // Tiszta fehér
    const whiteSpots = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', whiteForSpots, graySpotsMask3ch, whiteSpots);
    
    // ULTRA TISZTA kép: kép + fehér foltok
    const ultraCleanCombined = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', withoutGraySpots, whiteSpots, ultraCleanCombined);
    
    console.log('✅ Gray spots whitened');

    // === 18. FINOM CERUZAVONAL ÖSSZEKÖTÉS ===
    console.log('🔗 Gently connecting pencil lines...');
    
    // 1. FINOM vonalösszekötés: KISEBB kernel csak a közeli szakadások áthidalására
    const lineConnectKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(5, 5), // Kisebb kernel - csak közeli vonalakat köt össze
    );
    const connectedBlackMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', finalBlackMask, connectedBlackMask, 3, lineConnectKernel); // MORPH_CLOSE
    
    // 2. ENYHE dilate - csak kicsit vastagítjuk a vonalakat
    const gentleDilateKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(3, 3), // Nagyon kicsi kernel
    );
    const gentlyThickened = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', connectedBlackMask, gentlyThickened, 1, gentleDilateKernel); // 1x MORPH_DILATE
    
    // 3. FINOM sötétítés: NEM tiszta fekete, csak kicsit sötétebb
    // Konvertáljuk a maszkot 3 csatornásra
    const lineMask3ch = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(gentlyThickened, lineMask3ch);
    
    // A vonalakat csak KICSIT sötétítjük (nem fekete, hanem 20%-kal sötétebb)
    const darkenedLines = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', ultraCleanCombined, lineMask3ch, darkenedLines); // ultraCleanCombined használata!
    OpenCV.invoke('convertScaleAbs', darkenedLines, darkenedLines, 0.8, -15); // 20% sötétítés + kis offset
    
    // Fordított maszk: ahol NINCS vonal
    const invertedLineMask = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', gentlyThickened, invertedLineMask);
    const invertedLineMask3ch = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(invertedLineMask, invertedLineMask3ch);
    
    // Eredeti kép vonalak nélkül
    const originalWithoutLines = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', ultraCleanCombined, invertedLineMask3ch, originalWithoutLines); // ultraCleanCombined használata!
    
    // VÉGSŐ kombináció: eredeti kép + finoman sötétített vonalak
    const combinedWithBlackLines = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', originalWithoutLines, darkenedLines, combinedWithBlackLines);
    
    console.log('✅ Pencil lines gently connected and darkened');

    // === 19. PROFESSIONAL SCAN ===
    const scanMat = createMat(scaledHeight, scaledWidth, DataTypes.CV_8UC3);
    OpenCV.invoke(
      'convertScaleAbs',
      combinedWithBlackLines, // Használjuk a fekete vonalakkal ellátott képet!
      scanMat,
      SCAN_CONTRAST_ALPHA,
      SCAN_BRIGHTNESS_BETA,
    );

    // === 20. CROP ===
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

    // === 21. ALSÓ SÖTÉT KERET HOZZÁADÁSA ===
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

    // === 22. FEKETE SZÉL DETEKTÁLÁS (egyszerűsített) ===
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

    // === 23. FINAL CROP: Alsó 8% + fekete szél levágása ===
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

    // === 24. UTOLSÓ LÉPÉS: VILÁGOS TERÜLETEK FEHÉRÍTÉSE (50% küszöb) ===
    console.log('⚪ Final whitening: converting all pixels brighter than 50% to pure white');
    
    // Szürkeárnyalatos verzió a threshold-hoz
    const finalGray = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    cvtColorGray(finalCroppedResult, finalGray);
    
    // Threshold: minden 127 (50%) feletti pixel -> fehér maszk
    const whitenMask = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', finalGray, whitenMask, 127, 255, 0); // THRESH_BINARY: >127 -> 255
    
    // Maszk 3 csatornára konvertálása
    const whitenMask3ch = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(whitenMask, whitenMask3ch);
    
    // Invertált maszk: sötét területek (<=50%)
    const darkMask = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', whitenMask, darkMask);
    const darkMask3ch = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(darkMask, darkMask3ch);
    
    // Sötét területek megőrzése
    const darkAreas = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', finalCroppedResult, darkMask3ch, darkAreas);
    
    // Fehér területek létrehozása (tiszta fehér)
    const whiteAreas = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', finalCroppedResult, whiteAreas, 0, 255); // Tiszta fehér
    const whiteAreasFiltered = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', whiteAreas, whitenMask3ch, whiteAreasFiltered);
    
    // VÉGSŐ kép: sötét területek + fehér területek
    const ultraWhitenedResult = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', darkAreas, whiteAreasFiltered, ultraWhitenedResult);
    
    console.log('✅ Final whitening complete - all pixels >50% brightness are now pure white');

    // === 25. ERŐS VONAL ÖSSZEKÖTÉS RAJZOKRA ===
    console.log('🔗 Applying strong line connection for drawings...');
    
    // Szürkeárnyalatos verzió a morfológiához
    const drawingGray = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    cvtColorGray(ultraWhitenedResult, drawingGray);
    
    // Sötét vonalak maszkja (rajzok, szöveg)
    const drawingMask = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('threshold', drawingGray, drawingMask, 130, 255, 1); // THRESH_BINARY_INV: <150 = fekete vonalak
    
    // ERŐS CLOSE művelet: összekötjük a szakadozott vonalakat
    const closeKernelLarge = OpenCV.invoke(
      'getStructuringElement',
      0, // MORPH_RECT
      createSize(5, 5), // 5x5 kernel - összekötjük a közeli vonalakat
    );
    const closedDrawing = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', drawingMask, closedDrawing, 3, closeKernelLarge); // MORPH_CLOSE
    
    // Második CLOSE egy nagyobb kernellel az erősebb összekötésért
    const closeKernelXL = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(7, 7), // 7x7 kernel - még erősebb összekötés
    );
    const closedDrawingStrong = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', closedDrawing, closedDrawingStrong, 3, closeKernelXL); // MORPH_CLOSE
    
    // VASTAGÍTÁS: DILATE művelet a vonalak vastagításához (SOKKAL ERŐSEBB)
    const thickenKernel = OpenCV.invoke(
      'getStructuringElement',
      0,
      createSize(5, 5), // 5x5 kernel - erős vastagítás (3-ról 5-re)
    );
    const thickenedDrawing1 = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', closedDrawingStrong, thickenedDrawing1, 1, thickenKernel); // 1. DILATE
    
    const thickenedDrawing2 = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', thickenedDrawing1, thickenedDrawing2, 1, thickenKernel); // 2. DILATE
    
    const thickenedDrawing = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('morphologyEx', thickenedDrawing2, thickenedDrawing, 1, thickenKernel); // 3. DILATE - EXTRA VASTAG!
    
    // Konvertáljuk vissza 3 csatornássá
    const closedDrawingMask3ch = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(thickenedDrawing, closedDrawingMask3ch);
    
    // Invertált maszk: ahol NINCS rajz
    const noDrawingMask = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC1);
    OpenCV.invoke('bitwise_not', thickenedDrawing, noDrawingMask);
    const noDrawingMask3ch = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    cvtColorGray2BGR(noDrawingMask, noDrawingMask3ch);
    
    // Háttér (fehér területek) - ahol nincs rajz
    const whiteBg = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('convertScaleAbs', ultraWhitenedResult, whiteBg, 0, 255);
    const whiteBgFiltered = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', whiteBg, noDrawingMask3ch, whiteBgFiltered);
    
    // Sötét vonalak (rajzok) - ahol van rajz
    const darkDrawings = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('bitwise_and', ultraWhitenedResult, closedDrawingMask3ch, darkDrawings);
    
    // VÉGSŐ összekötött rajz
    const connectedResult = createMat(finalCropHeight, finalCropWidth, DataTypes.CV_8UC3);
    OpenCV.invoke('add', darkDrawings, whiteBgFiltered, connectedResult);
    
    console.log('✅ Strong line connection applied - drawings are now more connected');

    // === 26. BASE64 KONVERZIÓ ===
    const result = OpenCV.toJSValue(connectedResult);

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
