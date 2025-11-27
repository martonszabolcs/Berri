import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  useInferenceLogic,
  DetectionResult,
} from '../utils/scan/useInferenceLogic';
import { scanDocument } from '../utils/scan/scanDocument';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Image,
  TouchableOpacity,
  Platform,
  TouchableWithoutFeedback,
  Share,
  Animated,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Dirs, FileSystem } from 'react-native-file-access';
import { OpenCV, ObjectType, DataTypes } from 'react-native-fast-opencv';
import { saveScannedDocument } from '../utils/saveImage';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../store/hooks';

interface DocumentCorner {
  x: number;
  y: number;
}

// === DETECTION THRESHOLDS ===
const MIN_CONFIDENCE_THRESHOLD = 0.9; // Minimum confidence for auto-capture and "detected" state

// === UI SZÖVEGEK - KÖZPONTI KONFIGURÁCIÓ ===
// Minden felhasználónak megjelenő szöveget itt definiálunk egy helyen
// Ez megkönnyíti a későbbi szövegmódosításokat és fordítást
const UI_MESSAGES = {
  // Keresés / Nincs detektálás
  SEARCHING: 'Keresd a BERRĪ keretét',
  SEARCHING_INSTRUCTION:
    'Tedd a füzetet jól látható helyre, jó megvilágításban',

  // Részben látható (alacsony confidence)
  PARTIALLY_VISIBLE: (_confidence: number) => `BERRĪ részben látható`,
  PARTIALLY_INSTRUCTION: 'Próbáld beállítani a szöget',

  // Keresés folyamatban
  SEARCHING_PROGRESS: (_confidence: number) => `Keresés...`,
  SEARCHING_PROGRESS_INSTRUCTION: 'Mozgasd a kamerát a BERRĪ fölé',

  // Menj közelebb
  MOVE_CLOSER: (_confidence: number) => `Menj közelebb`,
  MOVE_CLOSER_INSTRUCTION: 'Menj közelebb a BERRĪ-hez',

  // Észlelve - QR kód nélkül
  DETECTED: (_confidence: number) => `BERRĪ észlelve!`,
  DETECTED_INSTRUCTION: 'Vidd közelebb a BERRĪ-hez',

  // Észlelve - QR kóddal (automatikus fotózás)
  DETECTED_WITH_QR: (_confidence: number) => `BERRĪ észlelve!`,
  DETECTED_WITH_QR_INSTRUCTION: 'Tartsd stabilan - Automatikus fotózás...',

  // Figyelmeztetés - téglalap alakja rossz
  RECTANGLE_WARNING: '  Tartsd szemben a füzettel!',

  // Figyelmeztetés - homályos kép
  BLUR_WARNING: '  Homályos a kép!',

  // Figyelmeztetés - túl ferde szög (perspektíva)
  PERSPECTIVE_WARNING: '  Vidd szembe a kamerát!',

  // Kamera engedély
  PERMISSION_NEEDED:
    'Kamera engedély szükséges a folytatáshoz. Kérlek, engedélyezd a kamerát a beállításokban.',
  PERMISSION_BUTTON: 'Kamera engedély kérése',

  // Gombok
  BUTTON_DEBUG_IMAGE: 'Debug mód',
  BUTTON_LIVE_VIEW: 'Élő kép',
  BUTTON_CAPTURE: 'Fotó',
  BUTTON_SHARE: 'Megosztás',
  BUTTON_CLOSE: '✕ Bezár',

  // Debug info
  DEBUG_BRIGHTNESS: (brightness: number | null, seekerInfo: string | null) =>
    `Fényerő: ${brightness !== null ? Math.round(brightness) : '?'} | ${
      seekerInfo || 'Loading...'
    }`,
} as const;

// === SHAPE VALIDATION ===
// checkRectangleShape() - A cornerek alapján ellenőrzi, hogy:
//   1. Van-e 4 sarok
//   2. Téglalap alakúak-e (ellentétes oldalak hasonlóak)
//   3. Álló tájolású-e (aspect ratio > 1.2)
//
// FONTOS: Ezt a függvényt CSAK a kiíráshoz használjuk:
//   - renderDocumentOverlay() - canvas szín meghatározásához
//   - getCurrentStatus() - warning üzenet hozzáadásához
//   - handleDetection() - DEBUG_ON esetén debug info frissítéséhez
//
// A shape ellenőrzést MINDIG frissen számoljuk ki amikor kell,
// NEM tárolunk state-ben (elkerüljük a szinkronizációs problémákat)

export default function App() {
  // === DEBUG FLAG - SZINKRONBAN A useInferenceLogic.tsx-ben lévővel ===
  const DEBUG_ON = false; // false = nincs debug kép, jobb teljesítmény!
  const navigation = useNavigation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Default DetectionResult - inicializálás lag elkerülésére
  const defaultDetectionResult: DetectionResult = {
    corners: [],
    confidence: 0,
    brightness: 0,
    seekerInfo: 'Kezdés...',
    qrInfo: undefined,
    qrPosition: null,
    qrBounds: null,
    blurInfo: undefined,
    frameWidth: screenWidth,
    frameHeight: screenHeight,
  };

  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null); // Camera ref for tap-to-focus
  const [results, setResults] = useState<DetectionResult[]>([
    defaultDetectionResult,
  ]);
  const [smoothedResults, setSmoothedResults] = useState<DetectionResult[]>([
    defaultDetectionResult,
  ]);

  const settings = useAppSelector(state => state.app.settings);

  // OPTIMALIZÁLÁS: Törölt felesleges state-ek (interpolatedCorners, previousCornersRef)
  const qrConsecutiveDetectionsRef = useRef(0);
  const qrConsecutiveNoDetectionsRef = useRef(0);
  const [showDebugImage, setShowDebugImage] = useState(false);
  const [currentDebugImage, setCurrentDebugImage] = useState<string | null>(
    null,
  );
  const [debugImageKey, setDebugImageKey] = useState(0); // Android-specific key for force re-render
  const lastDebugImageUpdate = useRef<number>(0);
  const detectionHistoryRef = useRef<DetectionResult[][]>([]);

  // Blur stability tracker - csak ha 3+ egymást követő frame blur, akkor jelezzük
  const blurHistoryRef = useRef<boolean[]>([]);
  const [stableIsBlurry, setStableIsBlurry] = useState(false);
  const BLUR_HISTORY_SIZE = 3; // 3 frame kell a stabilitáshoz

  // Track actual camera view dimensions from layout
  const [cameraViewSize, setCameraViewSize] = useState({
    width: screenWidth,
    height: screenHeight,
  });

  // Current brightness info for display
  const [currentBrightness, setCurrentBrightness] = useState<number | null>(
    null,
  );
  const [currentSeekerInfo, setCurrentSeekerInfo] = useState<string | null>(
    null,
  );
  const [currentQrInfo, setCurrentQrInfo] = useState<string | null>(null);
  const [currentQrPosition, setCurrentQrPosition] = useState<
    'left' | 'right' | null
  >(null);
  const [currentBlurInfo, setCurrentBlurInfo] = useState<string | null>(null);
  const [rectangleInfo, setRectangleInfo] = useState<string | null>(null);

  // QR kód detektálás kitartása - 1 mp ideig tartjuk ha egyszer beolvasva
  const qrDetectedTimestampRef = useRef<number | null>(null);
  const QR_PERSIST_DURATION = 3000; // 1 másodperc

  // QR kód "zárolás" - ha egyszer detektáltuk, akkor azt tartjuk
  const qrLockRef = useRef<'left' | 'right' | null>(null);

  // QR kód ÉRTÉK zárolás - ha egyszer megtaláltuk, tartjuk amíg fotó nem készül
  const qrValueLockRef = useRef<string | null>(null);

  const [_calibrationInfo, setCalibrationInfo] = useState<
    DetectionResult['calibrationInfo'] | null
  >(null);

  // Photo & torch states
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStatusMessage, setCaptureStatusMessage] = useState(
    'Tarts mozdulatlanul',
  );
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [capturedQrValue, setCapturedQrValue] = useState<string | null>(null); // QR kód érték a végeredményhez
  const [stepImages, setStepImages] = useState<
    { label: string; image: string }[]
  >([]);
  const [originalPhotoUri, setOriginalPhotoUri] = useState<string | null>(null); // Eredeti fotó
  const [showCapturedImage, setShowCapturedImage] = useState(false);
  const [debugCorners, setDebugCorners] = useState<
    { index: number; x: number; y: number }[] | null
  >(null);
  const [selectedIcons, setSelectedIcons] = useState<number[]>([]);
  const [selectedIconNames, setSelectedIconNames] = useState<string[]>([]);
  const [brightnessInfo, setBrightnessInfo] = useState<{
    avgBrightness: number;
    lightCondition: string;
    betaBoost: number;
  } | null>(null);
  const [isFrameProcessorActive, setIsFrameProcessorActive] = useState(true); // Frame processor on/off switch
  const [debugImagesEnabled, setDebugImagesEnabled] = useState(true); // Debug step images on/off

  // Animation states for capture
  const [isCaptureAnimating, setIsCaptureAnimating] = useState(false);
  const overlayScale = useRef(new Animated.Value(1)).current;
  const overlayTranslateY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // A4 capture animation
  const [showA4Animation, setShowA4Animation] = useState(false);
  const [a4AnimationImage, setA4AnimationImage] = useState<string | null>(null); // Beszkennelt kép az A4-ben
  const a4Scale = useRef(new Animated.Value(1)).current;
  const a4TranslateY = useRef(new Animated.Value(0)).current;
  const a4Opacity = useRef(new Animated.Value(1)).current;

  // Status infobox animation - csúszik le középről
  const infoboxTranslateY = useRef(new Animated.Value(0)).current;

  // Stabilized detection status - smooth transitions
  const [stableDetectionStatus, setStableDetectionStatus] = useState({
    isDetected: false,
    consecutiveDetected: 0,
    consecutiveNotDetected: 0,
  });

  // Auto-capture tracking
  const autoCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autoCaptureTriggeredRef = useRef(false);
  const handleCaptureRef = useRef<(() => void) | null>(null);

  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Android-specific: Reset debug image key when switching to debug view
  useEffect(() => {
    if (Platform.OS === 'android' && showDebugImage) {
      setDebugImageKey(prev => prev + 1);
    }
  }, [showDebugImage]);

  // Stabilize detection status to prevent flickering
  useEffect(() => {
    const THRESHOLD = 3; // Require 3 consecutive frames before changing state

    if (smoothedResults.length === 0) {
      // Not detected
      setStableDetectionStatus(prev => {
        const newConsecutiveNotDetected = prev.consecutiveNotDetected + 1;
        if (newConsecutiveNotDetected >= THRESHOLD && prev.isDetected) {
          // Switch to not detected after threshold
          return {
            isDetected: false,
            consecutiveDetected: 0,
            consecutiveNotDetected: newConsecutiveNotDetected,
          };
        }
        return {
          ...prev,
          consecutiveNotDetected: newConsecutiveNotDetected,
          consecutiveDetected: 0,
        };
      });
    } else {
      // Detected
      setStableDetectionStatus(prev => {
        const newConsecutiveDetected = prev.consecutiveDetected + 1;
        if (newConsecutiveDetected >= THRESHOLD && !prev.isDetected) {
          // Switch to detected after threshold
          return {
            isDetected: true,
            consecutiveDetected: newConsecutiveDetected,
            consecutiveNotDetected: 0,
          };
        }
        return {
          ...prev,
          consecutiveDetected: newConsecutiveDetected,
          consecutiveNotDetected: 0,
        };
      });
    }
  }, [smoothedResults]);

  // Helper function: Check if corners form a proper upright rectangle
  const checkRectangleShape = useCallback(
    (corners: DocumentCorner[]): { isGood: boolean; message: string } => {
      if (corners.length !== 4) {
        return { isGood: false, message: 'Shape:⚠️ Nincs 4 sarok' };
      }

      const dist = (p1: DocumentCorner, p2: DocumentCorner) =>
        Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

      // [topLeft, topRight, bottomRight, bottomLeft]
      const [topSide, rightSide, bottomSide, leftSide] = [
        dist(corners[0], corners[1]),
        dist(corners[1], corners[2]),
        dist(corners[2], corners[3]),
        dist(corners[3], corners[0]),
      ];

      // ÁTLÓK ellenőrzése - ne legyenek behajtva a sarkok
      const diagonal1 = dist(corners[0], corners[2]); // topLeft -> bottomRight
      const diagonal2 = dist(corners[1], corners[3]); // topRight -> bottomLeft

      // A sarkok ne legyenek túl közel egymáshoz (behajtva)
      // Minden sarok távolság legyen minimum a frame 10%-a
      const minCornerDistance = Math.min(
        topSide,
        rightSide,
        bottomSide,
        leftSide,
      );
      const frameSize =
        Math.max(topSide, bottomSide) + Math.max(leftSide, rightSide);
      const minAllowedDistance = frameSize * 0.15; // 15% minimum távolság

      if (minCornerDistance < minAllowedDistance) {
        return {
          isGood: false,
          message: `Shape:⚠️ Sarok behajtva vagy túl közel`,
        };
      }

      // Átlók aránya - egy téglalapnál kb egyforma hosszúak
      const diagonalRatio =
        Math.max(diagonal1, diagonal2) / Math.min(diagonal1, diagonal2);
      if (diagonalRatio > 1.3) {
        return {
          isGood: false,
          message: `Shape:⚠️ Átlók aránya rossz (${diagonalRatio.toFixed(2)})`,
        };
      }

      const horizontalRatio =
        Math.max(topSide, bottomSide) / Math.min(topSide, bottomSide);
      const verticalRatio =
        Math.max(leftSide, rightSide) / Math.min(leftSide, rightSide);
      const aspectRatio =
        (topSide + bottomSide) / 2 / ((leftSide + rightSide) / 2);

      const sidesGood = horizontalRatio < 1.5 && verticalRatio < 1.5;
      const isUpright = aspectRatio > 1.3;

      if (sidesGood && isUpright) {
        return {
          isGood: true,
          message: `Shape:✓ Álló téglalap (${aspectRatio.toFixed(2)})`,
        };
      } else if (sidesGood) {
        return {
          isGood: false,
          message: `Shape:⚠️ Téglalap de nem jó szög (${aspectRatio.toFixed(
            2,
          )})`,
        };
      }
      return {
        isGood: false,
        message: `Shape:⚠️ Nem téglalap (H:${horizontalRatio.toFixed(
          1,
        )}, V:${verticalRatio.toFixed(1)})`,
      };
    },
    [],
  );

  // Screen dimensions for coordinate transformation

  // Request good quality format for photo capture
  // Camera works in landscape, we'll rotate in processing

  // Smoothed detection callback
  const handleDetection = useCallback(
    (newResults: DetectionResult[]) => {
      setResults(newResults);

      if (newResults.length === 0 || !newResults[0].brightness) return;

      const result = newResults[0];

      // Update states only if changed (performance)
      if (result.brightness !== currentBrightness)
        setCurrentBrightness(result.brightness!);
      if (result.seekerInfo && result.seekerInfo !== currentSeekerInfo)
        setCurrentSeekerInfo(result.seekerInfo);
      if (result.blurInfo && result.blurInfo !== currentBlurInfo)
        setCurrentBlurInfo(result.blurInfo);
      if (result.calibrationInfo) setCalibrationInfo(result.calibrationInfo);

      // QR info with stability (anti-jitter)
      const QR_STABLE_THRESHOLD = { detect: 3, clear: 5 };

      // Ha már van QR lock, akkor azt használjuk és nem detektálunk újra
      if (qrLockRef.current) {
        // Megtartjuk a locked QR-t
        if (!currentQrInfo?.includes('QR:✓')) {
          setCurrentQrInfo('QR:✓ (locked)');
          setCurrentQrPosition(qrLockRef.current);
        }
      } else if (result.qrInfo?.includes('QR:✓')) {
        qrConsecutiveDetectionsRef.current++;
        qrConsecutiveNoDetectionsRef.current = 0;

        if (qrConsecutiveDetectionsRef.current >= QR_STABLE_THRESHOLD.detect) {
          setCurrentQrInfo(result.qrInfo);
          setCurrentQrPosition(result.qrPosition || null);
          qrDetectedTimestampRef.current = Date.now();

          // LOCK: Ha stabil QR-t találtunk, akkor azt rögzítjük!
          qrLockRef.current = result.qrPosition || null;
          console.log('🔒 QR locked:', qrLockRef.current);

          // QR ÉRTÉK LOCK: Ha van qrValue, zároljuk!
          if (result.qrValue && result.qrValue.length > 0) {
            qrValueLockRef.current = result.qrValue;
            console.log('🔒 QR VALUE locked:', qrValueLockRef.current);
          }
        }
      } else {
        qrConsecutiveDetectionsRef.current = 0;
        qrConsecutiveNoDetectionsRef.current++;

        const timeSinceQr = qrDetectedTimestampRef.current
          ? Date.now() - qrDetectedTimestampRef.current
          : Infinity;

        if (
          qrConsecutiveNoDetectionsRef.current >= QR_STABLE_THRESHOLD.clear &&
          timeSinceQr >= QR_PERSIST_DURATION
        ) {
          setCurrentQrInfo(result.qrInfo || null);
          setCurrentQrPosition(null);
          qrDetectedTimestampRef.current = null;
          // Ne töröljük a lock-ot! Csak akkor amikor új capture-t indítunk
        }
      }

      // Blur stability tracker - csak ha 3+ egymást követő frame blur, akkor jelezzük
      const currentFrameIsBlurry = result.blurInfo?.includes('⚠️') || false;
      blurHistoryRef.current.push(currentFrameIsBlurry);
      if (blurHistoryRef.current.length > BLUR_HISTORY_SIZE) {
        blurHistoryRef.current.shift();
      }

      // Csak akkor állítsuk be blur-nak, ha az ÖSSZES történeti frame blur
      if (blurHistoryRef.current.length >= BLUR_HISTORY_SIZE) {
        const allBlurry = blurHistoryRef.current.every(b => b === true);
        const allSharp = blurHistoryRef.current.every(b => b === false);

        if (allBlurry) {
          setStableIsBlurry(true);
        } else if (allSharp) {
          setStableIsBlurry(false);
        }
        // Ha vegyes, akkor megtartjuk az előző állapotot (nem változtatunk)
      }

      // Rectangle shape info (DEBUG only)
      if (DEBUG_ON && result.corners?.length === 4) {
        setRectangleInfo(checkRectangleShape(result.corners).message);
      } else if (DEBUG_ON) {
        setRectangleInfo(null);
      }

      // Debug image update
      if (DEBUG_ON && result.debugImage) {
        const now = Date.now();
        if (Platform.OS === 'android') {
          if (now - lastDebugImageUpdate.current > 100) {
            setCurrentDebugImage(result.debugImage);
            setDebugImageKey(prev => prev + 1);
            lastDebugImageUpdate.current = now;
          }
        } else {
          setCurrentDebugImage(result.debugImage);
        }
      }

      // Smoothing with weighted average (80% new, 20% old)
      if (
        newResults[0].corners.length === 4 &&
        newResults[0].confidence > 0.2
      ) {
        detectionHistoryRef.current.push(newResults);
        if (detectionHistoryRef.current.length > 2)
          detectionHistoryRef.current.shift();

        const validHistory = detectionHistoryRef.current.filter(
          d =>
            d.length > 0 && d[0].corners.length === 4 && d[0].confidence > 0.2,
        );

        if (validHistory.length >= 2) {
          const weights = [1, 4].map(w => w / 5); // [0.2, 0.8]
          const last = validHistory[validHistory.length - 1][0];

          const smoothedCorners = last.corners.map((_, idx) => ({
            x: validHistory.reduce(
              (sum, frame, i) => sum + frame[0].corners[idx].x * weights[i],
              0,
            ),
            y: validHistory.reduce(
              (sum, frame, i) => sum + frame[0].corners[idx].y * weights[i],
              0,
            ),
          }));

          const smoothedProcessedCorners = last.processedCorners?.map(
            (_, idx) => ({
              x: validHistory.reduce(
                (sum, frame, i) =>
                  sum + (frame[0].processedCorners?.[idx].x || 0) * weights[i],
                0,
              ),
              y: validHistory.reduce(
                (sum, frame, i) =>
                  sum + (frame[0].processedCorners?.[idx].y || 0) * weights[i],
                0,
              ),
            }),
          );

          const smoothedConfidence = validHistory.reduce(
            (sum, frame, i) => sum + frame[0].confidence * weights[i],
            0,
          );

          // DEBUG: Log QR value from last frame
          console.log(
            '🔍 smoothedResults - last.qrValue:',
            last.qrValue,
            'last.qrPosition:',
            last.qrPosition,
          );

          setSmoothedResults([
            {
              ...last,
              corners: smoothedCorners,
              processedCorners: smoothedProcessedCorners,
              confidence: smoothedConfidence,
              frameWidth: last.frameWidth,
              frameHeight: last.frameHeight,
              qrValue: last.qrValue, // QR kód tartalma átmásolása
              qrBounds: last.qrBounds, // QR bounds átmásolása
              qrPosition: last.qrPosition, // QR pozíció átmásolása
            },
          ]);
        } else {
          setSmoothedResults(newResults);
        }
      } else {
        // Nincs dokumentum detektálva - TÖRÖLJÜK A QR LOCK-OT!
        // Így ha újra megjelenik a dokumentum, újra detektálhatjuk a QR kódot
        detectionHistoryRef.current = [];
        setSmoothedResults([]);

        // QR lock törlése - új detektáláshoz
        qrLockRef.current = null;
        qrValueLockRef.current = null;
        qrConsecutiveDetectionsRef.current = 0;
        setCurrentQrInfo(null);
        setCurrentQrPosition(null);
        qrDetectedTimestampRef.current = null;
        console.log('🔓 QR unlocked - document lost');
      }
    },
    [
      DEBUG_ON,
      currentBrightness,
      currentSeekerInfo,
      currentBlurInfo,
      checkRectangleShape,
    ],
  );

  const { frameProcessor } = useInferenceLogic(
    handleDetection, // Use smoothed callback instead of setResults directly
    cameraViewSize.width,
    cameraViewSize.height,
    isFrameProcessorActive, // Pass the flag to control processing
  );

  // === PHOTO CAPTURE ===
  // Handles document photo capture and processing with animation
  const handleCapture = useCallback(async () => {
    // Validation: Check if we have valid document corners
    if (
      smoothedResults.length === 0 ||
      smoothedResults[0].corners.length !== 4
    ) {
      return;
    }

    if (!camera.current) {
      return;
    }

    try {
      // 🔴 KRITIKUS: AZONNAL rögzítjük a corner adatokat MIELŐTT bármi változna!
      console.log('📸 FREEZE: Capturing corner data snapshot NOW');

      // FRAME CORNEREK - processedCorners használata (már frame native felbontásban!)
      // Ez a useInferenceLogic-ból jön, már a frame native koordinátáiban van
      const captureFrameCorners =
        smoothedResults[0].processedCorners || smoothedResults[0].corners;

      // PROCESSED CORNEREK - ezek már a teljes felbontású fotóhoz fel vannak skálázva
      // Ez ugyanaz mint a captureFrameCorners, de megtartjuk a clarity kedvéért
      const captureProcessedCorners =
        smoothedResults[0].processedCorners || smoothedResults[0].corners;

      const captureQrPosition =
        qrLockRef.current || smoothedResults[0].qrPosition;
      const captureQrValue =
        qrValueLockRef.current || smoothedResults[0].qrValue; // ZÁROLT érték!
      const captureQrBounds = smoothedResults[0].qrBounds;
      const captureFrameWidth = smoothedResults[0].frameWidth;
      const captureFrameHeight = smoothedResults[0].frameHeight;
      const captureBrightness = smoothedResults[0].brightness || 128;

      console.log('📸 Capture data locked:', {
        frameCorners: captureFrameCorners.length,
        processedCorners: captureProcessedCorners.length,
        qrPosition: captureQrPosition,
        qrValue: captureQrValue,
        qrValueLocked: !!qrValueLockRef.current,
        frameSize: `${captureFrameWidth}x${captureFrameHeight}`,
      });

      // MOST leállítjuk a capture state-eket és a frame processort
      setIsCapturing(true);
      setIsCaptureAnimating(true);
      setIsFrameProcessorActive(false);
      setCaptureStatusMessage('Tarts mozdulatlanul');

      // === TÖBBSZÖRI FOTÓZÁS BLUR ÉS DETECTION MIATT ===
      // Maximum 3 fotót próbálunk, amíg nem lesz éles ÉS sikeres corner detection
      const MAX_PHOTO_ATTEMPTS = 3;
      const BLUR_THRESHOLD = 1; // Lowered because center 60% check gives lower variance than full frame

      let photoBase64 = '';
      let photoSize = { width: 0, height: 0 };
      let finalBlurScore = 0;
      let scanResult: any = null;

      for (
        let photoAttempt = 1;
        photoAttempt <= MAX_PHOTO_ATTEMPTS;
        photoAttempt++
      ) {
        console.log(
          `📸 Photo attempt ${photoAttempt}/${MAX_PHOTO_ATTEMPTS}...`,
        );
        setCaptureStatusMessage('Tarts mozdulatlanul');

        // Fotó készítése
        const photo = await camera.current.takePhoto({
          enableShutterSound: false,
        });

        console.log(`📸 Photo ${photoAttempt} taken:`, photo);

        photoBase64 = await FileSystem.readFile(photo.path, 'base64');
        photoSize = { width: photo.width, height: photo.height };
        // Fotó méretének lekérdezése

        // === BLUR ELLENŐRZÉS ===
        console.log('🔍 Checking photo blur...');
        setCaptureStatusMessage('Élesség ellenőrzése...');

        // Várunk egy kicsit hogy látható legyen az üzenet
        await new Promise<void>(resolve => setTimeout(resolve, 300));

        let checkMat = OpenCV.base64ToMat(photoBase64);

        // PORTRAIT MODE ENFORCEMENT - Ha landscape, forgassuk el a blur check előtt is!
        let blurCheckWidth = photoSize.width || 0;
        let blurCheckHeight = photoSize.height || 0;

        if (blurCheckWidth > blurCheckHeight) {
          console.log(
            `🔄 Photo is LANDSCAPE (${blurCheckWidth}x${blurCheckHeight}) - rotating for blur check`,
          );
          const tempRotated = OpenCV.createObject(
            ObjectType.Mat,
            blurCheckWidth,
            blurCheckHeight,
            DataTypes.CV_8UC3,
          );
          OpenCV.invoke('rotate', checkMat, tempRotated, 0); // 0 = ROTATE_90_CLOCKWISE
          checkMat = OpenCV.invoke('clone', tempRotated);

          // Swap dimensions after rotation
          const temp = blurCheckWidth;
          blurCheckWidth = blurCheckHeight;
          blurCheckHeight = temp;

          console.log(
            `✅ After rotation for blur check: ${blurCheckWidth}x${blurCheckHeight}`,
          );
        }

        console.log(
          `📸 Photo dimensions for blur check: ${blurCheckWidth}x${blurCheckHeight}`,
        );

        const grayCheckMat = OpenCV.createObject(
          ObjectType.Mat,
          blurCheckHeight,
          blurCheckWidth,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke('cvtColor', checkMat, grayCheckMat, 6, 0);

        // Crop to center 60% to focus on document area (avoid edges)
        const centerCropX = Math.round(blurCheckWidth * 0.2);
        const centerCropY = Math.round(blurCheckHeight * 0.2);
        const centerCropWidth = Math.round(blurCheckWidth * 0.6);
        const centerCropHeight = Math.round(blurCheckHeight * 0.6);

        console.log(
          `📐 Blur check region: x=${centerCropX}, y=${centerCropY}, w=${centerCropWidth}, h=${centerCropHeight}`,
        );

        const centerRect = OpenCV.createObject(
          ObjectType.Rect,
          centerCropX,
          centerCropY,
          centerCropWidth,
          centerCropHeight,
        );

        const centerMat = OpenCV.createObject(
          ObjectType.Mat,
          centerCropHeight,
          centerCropWidth,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke('crop', grayCheckMat, centerMat, centerRect);

        const laplacianMat = OpenCV.createObject(
          ObjectType.Mat,
          centerCropHeight,
          centerCropWidth,
          DataTypes.CV_64F,
        );
        OpenCV.invoke(
          'Laplacian',
          centerMat,
          laplacianMat,
          DataTypes.CV_64F,
          1,
          1,
          0,
          4,
        );

        const absLaplacian = OpenCV.createObject(
          ObjectType.Mat,
          centerCropHeight,
          centerCropWidth,
          DataTypes.CV_8UC1,
        );
        OpenCV.invoke('convertScaleAbs', laplacianMat, absLaplacian, 1, 0);

        const varianceScalar = OpenCV.invoke('mean', absLaplacian);
        const varianceData = OpenCV.toJSValue(varianceScalar);
        finalBlurScore = varianceData.a || 0;

        console.log(
          `📊 Photo ${photoAttempt} blur (center 60%):`,
          finalBlurScore.toFixed(2),
        );
        setCaptureStatusMessage(`Élesség: ${finalBlurScore.toFixed(1)}`);

        // Várunk egy kicsit hogy látható legyen az üzenet
        await new Promise<void>(resolve => setTimeout(resolve, 300));

        // ELŐSZÖR ellenőrizzük a blur-t - ha homályos, NE indítsuk el a scan-t!
        const isBlurry = finalBlurScore < BLUR_THRESHOLD;

        if (isBlurry) {
          console.log(
            `⚠️ Photo ${photoAttempt} too blurry (${finalBlurScore.toFixed(
              2,
            )}). Retrying...`,
          );
          // Ha ez az utolsó próbálkozás, feladjuk
          if (photoAttempt === MAX_PHOTO_ATTEMPTS) {
            console.warn(
              `⚠️ Failed after ${MAX_PHOTO_ATTEMPTS} attempts (all blurry). Restarting detection...`,
            );

            // Reset auto-capture és újraindítás
            autoCaptureTriggeredRef.current = false;
            autoCaptureTimerRef.current = null;

            setIsCapturing(false);
            setIsCaptureAnimating(false);
            overlayScale.setValue(1);
            overlayTranslateY.setValue(0);
            overlayOpacity.setValue(1);
            setIsFrameProcessorActive(true);
            console.log('▶️ Resuming frame processor - restarting detection');
            return;
          }
          // Folytatjuk a következő próbálkozással (skip scan)
          continue;
        }

        // Ha NEM homályos, AKKOR futtatjuk a corner detection-t
        console.log('🔍 Attempting corner detection...');
        setCaptureStatusMessage('Sarkok keresése...');

        // Várunk egy kicsit hogy látható legyen az üzenet
        await new Promise<void>(resolve => setTimeout(resolve, 300));

        console.log('🔍 QR data being passed to scanDocument:', {
          captureQrValue,
          captureQrPosition,
          captureQrBounds,
        });

        scanResult = await scanDocument({
          rawImageBase64: photoBase64,
          frameCorners: captureFrameCorners,
          processedCorners: captureProcessedCorners,
          currentQrValue: captureQrValue,
          currentQrPosition: captureQrPosition,
          qrBounds: captureQrBounds,
          photoWidth: photoSize.width,
          photoHeight: photoSize.height,
          frameWidth: captureFrameWidth,
          frameHeight: captureFrameHeight,
          frameBrightness: captureBrightness,
          enableDebugImages: debugImagesEnabled,
        });

        console.log(`📊 Attempt ${photoAttempt} results:`, {
          blur: finalBlurScore.toFixed(2),
          isBlurry: false,
          detectionSuccess: scanResult.success,
        });

        // Ha sikeres detection, kész vagyunk!
        if (scanResult.success) {
          console.log(
            `✅ Photo ${photoAttempt} is good! Blur: ${finalBlurScore.toFixed(
              2,
            )}, Detection: OK`,
          );
          setCaptureStatusMessage('Feldolgozás...');
          break;
        }

        // Ha ez az utolsó próbálkozás és a detection nem sikerült, feladjuk
        if (photoAttempt === MAX_PHOTO_ATTEMPTS) {
          console.warn(
            `⚠️ Failed after ${MAX_PHOTO_ATTEMPTS} attempts. Restarting detection...`,
          );

          // Reset auto-capture és újraindítás
          autoCaptureTriggeredRef.current = false;
          autoCaptureTimerRef.current = null;

          setIsCapturing(false);
          setIsCaptureAnimating(false);
          overlayScale.setValue(1);
          overlayTranslateY.setValue(0);
          overlayOpacity.setValue(1);
          setIsFrameProcessorActive(true);
          console.log('▶️ Resuming frame processor - restarting detection');
          return;
        }

        // Különben újra próbálkozunk
        console.log(
          `⚠️ Photo ${photoAttempt} corner detection failed. Retrying...`,
        );
      }

      console.log(
        `✅ Final result - Blur: ${finalBlurScore.toFixed(2)}, Success: ${
          scanResult?.success
        }`,
      );

      // Ha végül sem sikerült a detection - CSENDESEN ÚJRAKEZDJÜK
      if (!scanResult || !scanResult.success) {
        console.log(
          '⚠️ Photo detection failed - silently restarting detection',
        );

        // Reset auto-capture state
        autoCaptureTriggeredRef.current = false;
        autoCaptureTimerRef.current = null;

        // Reset UI state
        setIsCapturing(false);
        setIsCaptureAnimating(false);
        overlayScale.setValue(1);
        overlayTranslateY.setValue(0);
        overlayOpacity.setValue(1);

        // Restart frame processor - user can try again
        setIsFrameProcessorActive(true);
        console.log('▶️ Frame processor restarted - ready for next attempt');
        return; // Silent fail - no error message to user
      }

      // Sikeres scan - folytatjuk az animációval

      if (scanResult.success && scanResult.imageBase64) {
        // Most már van beszkennelt kép - megjelenítjük az A4-ben
        setA4AnimationImage(scanResult.imageBase64);
        setShowA4Animation(true);
        a4Scale.setValue(1);
        a4TranslateY.setValue(0);
        a4Opacity.setValue(1);

        // Store step images if available
        if (scanResult.stepImages) {
          setStepImages(scanResult.stepImages);
        }

        // Várunk egy picit hogy megjelenjen
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        // Animáció: lassabban, simábban - LENT MARAD
        Animated.parallel([
          Animated.timing(a4Scale, {
            toValue: 0.25, // Még kisebb
            duration: 600, // Hosszabb animáció
            useNativeDriver: true,
          }),
          Animated.timing(a4TranslateY, {
            toValue: screenHeight * 1.2, // Lejjebb csúszik és OTT MARAD
            duration: 600,
            useNativeDriver: true,
          }),
          // NINCS opacity animáció - látható marad!
        ]).start();

        // Várunk az animációra + 400ms extra várakozás lent
        await new Promise<void>(resolve => setTimeout(resolve, 1300));

        setCapturedImageUri(scanResult.imageBase64); // Beszkennelt kép
        setCapturedQrValue(scanResult.qrValue || null); // QR kód érték
        setOriginalPhotoUri(photoBase64); // Eredeti fotó
        setDebugCorners(scanResult.debugCorners || null);
        setSelectedIcons(scanResult.selectedIcons || []);
        setSelectedIconNames(scanResult.selectedIconNames || []);
        setBrightnessInfo(scanResult.brightnessInfo || null);
        setShowCapturedImage(true);
      }
    } catch (error) {
      // Silent fail - user can retry
      console.error('Photo capture error:', error);
    } finally {
      setIsCapturing(false);
      setIsCaptureAnimating(false);

      // Reset animáció értékek
      overlayScale.setValue(1);
      overlayTranslateY.setValue(0);
      overlayOpacity.setValue(1);

      // 🟢 START: Indítsuk újra a frame processor-t!
      console.log('▶️ Resuming frame processor');
      setIsFrameProcessorActive(true);
    }
  }, [
    smoothedResults,
    overlayScale,
    overlayTranslateY,
    overlayOpacity,
    screenHeight,
    a4Scale,
    a4TranslateY,
    a4Opacity,
    debugImagesEnabled,
  ]);

  // === SHARE FUNCTIONALITY ===
  // Handles sharing the captured image
  const handleShare = useCallback(async () => {
    if (!capturedImageUri) return;
    // Save to permanent storage with unique filename
    const savedPath = await saveScannedDocument(capturedImageUri, settings);

    if (savedPath) {
      console.log('✅ Document saved permanently:', savedPath);

      // Navigate to DestinationSelectScreen with the saved file path
      navigation.navigate('DestinationSelectScreen', {
        savedFilePath: savedPath,
        destinationType: 1,
      });
    }

    try {
      // Save the base64 image to a temporary file
      const tempPath = `${Dirs.CacheDir}/captured_document.jpg`;

      await FileSystem.writeFile(tempPath, capturedImageUri, 'base64');

      await Share.share({
        url: `file://${tempPath}`,
        message: 'Beszkennelt BERRĪ füzet',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [capturedImageUri]);

  // === TAP TO FOCUS ===
  // Focuses the camera at the tapped location
  const handleCameraTap = useCallback(
    async (event: any) => {
      const { locationX, locationY } = event.nativeEvent;

      try {
        await camera.current?.focus({
          x: locationX / cameraViewSize.width,
          y: locationY / cameraViewSize.height,
        });
      } catch (error) {
        // Focus failed - ignore
      }
    },
    [cameraViewSize.width, cameraViewSize.height],
  );

  const format = useCameraFormat(device, [
    { photoHdr: true, photoResolution: 'max' },
  ]);

  // Update handleCaptureRef when handleCapture changes
  useEffect(() => {
    handleCaptureRef.current = handleCapture;
  }, [handleCapture]);

  // === AUTO-CAPTURE EFFECT ===
  // Automatikusan fotóz amikor a dokumentum jól detektálva van
  useEffect(() => {
    // Csak akkor működjön ha:
    // 1. Van detektált dokumentum 4 sarokkal
    // 2. Confidence >= MIN_CONFIDENCE_THRESHOLD
    // 3. Téglalap alakú jó
    // 4. Nincs még fotó folyamatban
    // 5. Modal nincs nyitva
    // 6. Még nem triggereltünk auto-capture-t
    // 7. QR KÓD BE VAN OLVASVA
    // 8. BLUR OK - HOMÁLYOSSÁG ELLENŐRZÉS!

    const blurInfo = smoothedResults[0]?.blurInfo;
    const isBlurry = blurInfo?.includes('⚠️');

    console.log('🔍 Auto-capture check:', {
      hasResults: smoothedResults.length > 0,
      hasCorners: smoothedResults[0]?.corners.length === 4,
      confidence: smoothedResults[0]?.confidence,
      qrValue: smoothedResults[0]?.qrValue,
      qrValueLocked: qrValueLockRef.current,
      blurInfo: blurInfo,
      isBlurry: isBlurry,
      stableIsBlurry,
      isCapturing,
      isCaptureAnimating,
      showCapturedImage,
      alreadyTriggered: autoCaptureTriggeredRef.current,
      timerExists: !!autoCaptureTimerRef.current,
    });

    // QR kód érték ellenőrzése - ZÁROLT vagy friss érték
    const qrValue = qrValueLockRef.current || smoothedResults[0]?.qrValue;
    const hasQrValue = typeof qrValue === 'string' && qrValue.length > 0;

    console.log('🔍 QR check for auto-capture:', {
      qrValue,
      hasQrValue,
      locked: !!qrValueLockRef.current,
    });

    if (
      smoothedResults.length > 0 &&
      smoothedResults[0].corners.length === 4 &&
      smoothedResults[0].confidence >= MIN_CONFIDENCE_THRESHOLD &&
      hasQrValue && // QR KÓD KELL AZ AUTO-CAPTURE-HEZ!
      !stableIsBlurry && // STABIL BLUR ELLENŐRZÉS!
      !isCapturing &&
      !isCaptureAnimating &&
      !showCapturedImage &&
      !autoCaptureTriggeredRef.current
    ) {
      const { isGood: isRectangleGood } = checkRectangleShape(
        smoothedResults[0].corners,
      );

      console.log(
        '✅ Auto-capture conditions met, rectangle good?',
        isRectangleGood,
      );

      if (isRectangleGood) {
        const now = Date.now();

        // Store timestamp when conditions first met (ref is a number now)
        if (!autoCaptureTimerRef.current) {
          console.log('⏱️ Starting auto-capture countdown (3000ms)');
          autoCaptureTimerRef.current = now as any;
        } else {
          // Check if enough time has passed - 3000ms várakozás ha minden rendben van
          const elapsed = now - (autoCaptureTimerRef.current as any as number);

          if (elapsed >= 1000) {
            console.log('🎯 Auto-capture triggered after', elapsed, 'ms');

            // EXTRA ELLENŐRZÉS: Még mindig jó a detektálás?
            const finalQrValue =
              qrValueLockRef.current || smoothedResults[0]?.qrValue;
            const finalHasQrValue =
              typeof finalQrValue === 'string' && finalQrValue.length > 0;
            console.log('🔍 Final QR check:', {
              finalQrValue,
              finalHasQrValue,
              locked: !!qrValueLockRef.current,
            });

            const finalCheck =
              smoothedResults.length > 0 &&
              smoothedResults[0].corners.length === 4 &&
              smoothedResults[0].confidence >= MIN_CONFIDENCE_THRESHOLD &&
              finalHasQrValue && // QR KÓD KELL!
              !stableIsBlurry && // STABIL BLUR ELLENŐRZÉS!
              !isCapturing &&
              !isCaptureAnimating &&
              !showCapturedImage;

            const { isGood: finalRectangleCheck } = checkRectangleShape(
              smoothedResults[0].corners,
            );

            if (finalCheck && finalRectangleCheck) {
              console.log('✅ Final check passed - capturing!');
              autoCaptureTriggeredRef.current = true;
              autoCaptureTimerRef.current = null;

              // Trigger capture
              if (handleCaptureRef.current) {
                handleCaptureRef.current();
              }
            } else {
              console.log(
                '❌ Final check FAILED - conditions changed, not capturing',
              );
              autoCaptureTimerRef.current = null;
            }
          } else {
            console.log('⏱️ Countdown:', elapsed, '/ 3000 ms');
          }
        }
      } else {
        // Rectangle not good, reset timestamp
        if (autoCaptureTimerRef.current) {
          console.log('❌ Rectangle not good, clearing timer');
          autoCaptureTimerRef.current = null;
        }
      }
    } else {
      // Ha a feltételek nem teljesülnek, töröljük a timestamp-et
      if (autoCaptureTimerRef.current) {
        console.log('❌ Auto-capture conditions not met, clearing timer');
        autoCaptureTimerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    smoothedResults,
    currentQrPosition, // QR lock state!
    isCapturing,
    isCaptureAnimating,
    showCapturedImage,
    // checkRectangleShape és handleCapture nincs benne - stabil referenciák
  ]);

  // Reset auto-capture flag when modal is closed
  useEffect(() => {
    if (!showCapturedImage) {
      autoCaptureTriggeredRef.current = false;
    }
  }, [showCapturedImage]);

  // === STATUS CALCULATION ===
  // Determines current UI state based on detection confidence and shape
  const getCurrentStatus = () => {
    // Use smoothed results instead of raw results for stability
    if (smoothedResults.length === 0) {
      return {
        isDetected: stableDetectionStatus.isDetected, // Use stable status
        isRectangleGood: true,
        message: UI_MESSAGES.SEARCHING,
        instruction: UI_MESSAGES.SEARCHING_INSTRUCTION,
      };
    }

    const latestResult = smoothedResults[0]; // Use smoothed results
    let confidence = latestResult.confidence;

    // QR kód ellenőrzés - ZÁROLT vagy friss érték
    const qrVal = qrValueLockRef.current || latestResult?.qrValue;
    const hasRealQrValue = typeof qrVal === 'string' && qrVal.length > 0;

    // BLUR ELLENŐRZÉS - használjuk a stabil verzió
    const blurWarning = stableIsBlurry ? UI_MESSAGES.BLUR_WARNING : '';

    // PERSPEKTÍVA ELLENŐRZÉS - túl ferde szög figyelmeztetés
    const perspectiveWarning = latestResult.perspectiveWarning
      ? UI_MESSAGES.PERSPECTIVE_WARNING
      : '';

    // QR figyelmeztetés - nem kell külön üzenet, az instruction már tartalmazza

    if (latestResult.corners?.length === 4) {
      const { isGood: isRectangleGood } = checkRectangleShape(
        latestResult.corners,
      );

      // Penalize confidence if shape is bad
      if (!isRectangleGood && confidence > 0.9) {
        confidence = 0.5;
      }

      const rectangleWarning = !isRectangleGood
        ? UI_MESSAGES.RECTANGLE_WARNING
        : '';

      // Low confidence - move closer
      if (confidence < MIN_CONFIDENCE_THRESHOLD) {
        return {
          isDetected: false,
          isRectangleGood,
          message: UI_MESSAGES.MOVE_CLOSER(confidence),
          instruction:
            UI_MESSAGES.MOVE_CLOSER_INSTRUCTION +
            rectangleWarning +
            blurWarning +
            perspectiveWarning,
        };
      }

      // High confidence - detected
      // Ha van QR kód → automatikus fotózás, ha nincs → várakozás
      if (hasRealQrValue) {
        return {
          isDetected: true,
          isRectangleGood,
          message: UI_MESSAGES.DETECTED_WITH_QR(confidence),
          instruction:
            UI_MESSAGES.DETECTED_WITH_QR_INSTRUCTION +
            rectangleWarning +
            blurWarning +
            perspectiveWarning,
        };
      } else {
        return {
          isDetected: true,
          isRectangleGood,
          message: UI_MESSAGES.DETECTED(confidence),
          instruction:
            UI_MESSAGES.DETECTED_INSTRUCTION +
            rectangleWarning +
            blurWarning +
            perspectiveWarning,
        };
      }
    }

    // Fallback - no valid corners
    if (confidence > 0.5) {
      if (hasRealQrValue) {
        return {
          isDetected: true,
          isRectangleGood: true,
          message: UI_MESSAGES.DETECTED_WITH_QR(confidence),
          instruction:
            UI_MESSAGES.DETECTED_WITH_QR_INSTRUCTION +
            blurWarning +
            perspectiveWarning,
        };
      } else {
        return {
          isDetected: true,
          isRectangleGood: true,
          message: UI_MESSAGES.DETECTED(confidence),
          instruction:
            UI_MESSAGES.DETECTED_INSTRUCTION + blurWarning + perspectiveWarning,
        };
      }
    } else if (confidence > 0.2) {
      return {
        isDetected: false,
        isRectangleGood: true,
        message: UI_MESSAGES.PARTIALLY_VISIBLE(confidence),
        instruction:
          UI_MESSAGES.PARTIALLY_INSTRUCTION + blurWarning + perspectiveWarning,
      };
    }

    return {
      isDetected: false,
      isRectangleGood: true,
      message: UI_MESSAGES.SEARCHING_PROGRESS(confidence),
      instruction:
        UI_MESSAGES.SEARCHING_PROGRESS_INSTRUCTION +
        blurWarning +
        perspectiveWarning,
    };
  };

  const currentStatus = getCurrentStatus();

  // Infobox animáció - csúszik le amikor detektálva van
  useEffect(() => {
    if (currentStatus.isDetected) {
      // Detektálva → csúszik le középről az alsó pozícióra
      Animated.timing(infoboxTranslateY, {
        toValue: 1, // 1 = lent van
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Nincs detektálva → visszamegy középre
      Animated.timing(infoboxTranslateY, {
        toValue: 0, // 0 = középen van
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [currentStatus.isDetected, infoboxTranslateY]);

  // === OVERLAY RENDERING ===
  // Renders document corners overlay on camera feed
  const renderDocumentOverlay = () => {
    if (smoothedResults.length === 0 || smoothedResults[0].corners.length !== 4)
      return null;

    const { corners, confidence } = smoothedResults[0];
    const { isGood: isRectangleGood } = checkRectangleShape(corners);

    // QR kód ellenőrzés - CSAK ZÁROLT értéket nézünk a FILL-hez!
    // Ez megakadályozza a villogást, mert a lock stabil
    const hasLockedQrValue =
      typeof qrValueLockRef.current === 'string' &&
      qrValueLockRef.current.length > 0;

    // Build path from corners
    const path = Skia.Path.Make();
    path.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach(c => path.lineTo(c.x, c.y));
    path.close();

    // Determine overlay color and style
    const COLORS = { GREEN: '#B2FBA5', YELLOW: '#FFF52E', RED: '#FF746C' };

    let pathColor: string;
    let pathStyle: 'fill' | 'stroke' = 'stroke';
    let strokeWidth = 4;

    if (!isRectangleGood) {
      pathColor = COLORS.RED;
    } else if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
      pathColor = COLORS.GREEN;
      // Ha van ZÁROLT QR kód ÉRTÉK → teli zöld, ha nincs → csak keret
      // FONTOS: Csak locked-ot nézünk, nem a friss értéket - ez megakadályozza a villogást!
      pathStyle = hasLockedQrValue ? 'fill' : 'stroke';
      strokeWidth = hasLockedQrValue ? 0 : 4;
    } else if (confidence >= 0.6) {
      pathColor = COLORS.YELLOW;
    } else {
      pathColor = COLORS.RED;
    }

    return (
      <>
        <Path
          path={path}
          color={pathColor}
          style={pathStyle}
          strokeWidth={strokeWidth}
        />
        {corners.map((corner, i) => (
          <Circle
            key={i}
            cx={corner.x}
            cy={corner.y}
            r={1}
            color={pathColor}
            style="fill"
          />
        ))}
      </>
    );
  };

  if (!hasPermission) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Text
          style={{
            color: 'black',
            fontSize: 16,
            textAlign: 'center',
            paddingHorizontal: 20,
          }}
        >
          {UI_MESSAGES.PERMISSION_NEEDED}
        </Text>
        <TouchableOpacity
          style={[styles.switchButton, { marginTop: 20 }]}
          onPress={requestPermission}
        >
          <Text style={styles.switchButtonText}>
            {UI_MESSAGES.PERMISSION_BUTTON}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {device && (
        <>
          <TouchableWithoutFeedback onPress={handleCameraTap}>
            <View style={styles.camera}>
              <Camera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                focusable={true}
                photo={true}
                enableFpsGraph={false}
                torch={torchEnabled ? 'on' : 'off'}
                isActive={!showCapturedImage}
                frameProcessor={frameProcessor}
                resizeMode="cover"
                onLayout={event => {
                  const { width, height } = event.nativeEvent.layout;
                  setCameraViewSize({ width, height });
                }}
              />
            </View>
          </TouchableWithoutFeedback>
          {/* Debug image display - CSAK HA DEBUG_ON === true */}
          {DEBUG_ON && showDebugImage && currentDebugImage && (
            <View style={styles.debugImageContainer}>
              <Image
                key={
                  Platform.OS === 'android'
                    ? `android-${debugImageKey}`
                    : currentDebugImage.substring(0, 50)
                }
                source={{
                  uri: `data:image/jpeg;base64,${currentDebugImage}`,
                }}
                style={styles.debugImage}
                // Android-specific props for better performance
                {...(Platform.OS === 'android' && {
                  resizeMode: 'contain',
                  fadeDuration: 0, // Disable fade animation on Android
                  loadingIndicatorSource: undefined, // Remove loading indicator
                })}
              />
            </View>
          )}

          {/* Debug Image Switch - KIKAPCSOLVA */}
          {/* {DEBUG_ON && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setShowDebugImage(!showDebugImage)}
            >
              <Text style={styles.switchButtonText}>
                {showDebugImage
                  ? UI_MESSAGES.BUTTON_LIVE_VIEW
                  : UI_MESSAGES.BUTTON_DEBUG_IMAGE}
              </Text>
            </TouchableOpacity>
          )} */}

          {/* Torch (világítás) gomb */}
          <TouchableOpacity
            style={[styles.torchButton]}
            onPress={() => setTorchEnabled(!torchEnabled)}
          >
            <Text style={styles.torchButtonText}>
              {torchEnabled ? '🔦 BE' : '🔦 KI'}
            </Text>
          </TouchableOpacity>

          {/* Debug Images toggle - jobb felső sarok */}
          <TouchableOpacity
            style={[styles.debugToggleButton]}
            onPress={() => setDebugImagesEnabled(!debugImagesEnabled)}
          >
            <Text style={styles.debugToggleText}>
              {debugImagesEnabled ? '🐛 ON' : '🐛 OFF'}
            </Text>
          </TouchableOpacity>

          {/* Document overlay - ANIMÁLT verzió - MARAD AMÍG A4 NEM JELENIK MEG */}
          {/* Használjuk a stabil detection status-t hogy ne villogjon */}
          {stableDetectionStatus.isDetected &&
            smoothedResults.length > 0 &&
            smoothedResults[0].corners.length === 4 &&
            !showA4Animation &&
            isFrameProcessorActive &&
            !isCapturing && ( // 🔴 NE mutassuk fotózás közben - itt már rögzítve van az adat!
              <Animated.View
                style={[
                  styles.overlay,
                  {
                    width: cameraViewSize.width,
                    height: cameraViewSize.height,
                    transform: [
                      { scale: overlayScale },
                      { translateY: overlayTranslateY },
                    ],
                    opacity: overlayOpacity,
                  },
                ]}
              >
                <Canvas
                  style={{
                    width: cameraViewSize.width,
                    height: cameraViewSize.height,
                  }}
                >
                  {renderDocumentOverlay()}
                </Canvas>
              </Animated.View>
            )}

          {/* Spinner amikor a frame processor leáll (fotózás alatt) */}
          {!isFrameProcessorActive && !showA4Animation && (
            <View style={styles.processingSpinnerOverlay}>
              <View style={styles.processingSpinnerContainer}>
                <ActivityIndicator size="large" color="#00ff00" />
                <Text style={styles.processingSpinnerText}>
                  {captureStatusMessage}
                </Text>
              </View>
            </View>
          )}

          {/* A4 Capture Animation - fehér téglalap + beszkennelt kép */}
          {showA4Animation &&
            (() => {
              // A4 arány: 1:1.414 (álló)
              const a4Ratio = 1.414;
              const a4Width = screenWidth * 0.85;
              const a4Height = a4Width * a4Ratio;

              return (
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: (screenWidth - a4Width) / 2,
                    top: (screenHeight - a4Height) / 2,
                    width: a4Width,
                    height: a4Height,
                    backgroundColor: 'white',
                    borderRadius: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 10,
                    transform: [
                      { scale: a4Scale },
                      { translateY: a4TranslateY },
                    ],
                    opacity: a4Opacity,
                    overflow: 'hidden', // Kép ne lógjon ki
                  }}
                >
                  {/* Beszkennelt kép megjelenítése */}
                  {a4AnimationImage && (
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${a4AnimationImage}`,
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 8,
                      }}
                      resizeMode="cover"
                    />
                  )}
                </Animated.View>
              );
            })()}

          {/* Status indicator with detailed message - ANIMÁLT LECSÚSZÁS */}
          {!isCapturing &&
            !isCaptureAnimating &&
            (() => {
              // Interpoláció: 0 = középen (50%), 1 = lent (bottom 100px)
              const translateY = infoboxTranslateY.interpolate({
                inputRange: [0, 1],
                outputRange: [screenHeight * 0.5 - 50, screenHeight - 150], // Középről le
              });

              return (
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 0,
                    alignSelf: 'center',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: currentStatus.isDetected
                      ? 'rgba(0, 0, 0, 0.8)'
                      : 'rgba(0, 0, 0, 0.5)',
                    paddingHorizontal: currentStatus.isDetected ? 15 : 20,
                    paddingVertical: currentStatus.isDetected ? 12 : 15,
                    borderRadius: 20,
                    width: currentStatus.isDetected ? undefined : 300,
                    maxWidth: '90%',
                    zIndex: 100,
                    transform: [{ translateY }],
                  }}
                >
                  <View
                    style={[
                      styles.statusIndicator,
                      (smoothedResults.length > 0 &&
                        smoothedResults[0].confidence < 0.6) ||
                      (results.length > 0 && results[0].confidence < 0.6)
                        ? styles.statusNotDetected
                        : (smoothedResults.length > 0 &&
                            smoothedResults[0].confidence <
                              MIN_CONFIDENCE_THRESHOLD) ||
                          (results.length > 0 &&
                            results[0].confidence < MIN_CONFIDENCE_THRESHOLD)
                        ? styles.statusWarning
                        : currentStatus.isDetected
                        ? styles.statusDetected
                        : styles.statusNotDetected,
                    ]}
                  />
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusText}>
                      {currentStatus.message}
                    </Text>
                    <Text style={styles.instructionText}>
                      {currentStatus.instruction}
                    </Text>
                  </View>
                </Animated.View>
              );
            })()}

          {/* UI Controls */}
          <View style={styles.controlsContainer}>
            {/* Debug információk - OPTIMALIZÁLÁS: Csak ha DEBUG_ON vagy van érték */}
            {showDebugImage &&
              (currentBrightness !== null ||
                currentSeekerInfo ||
                currentQrInfo ||
                currentBlurInfo ||
                rectangleInfo) && (
                <View style={styles.brightnessContainer}>
                  <Text style={styles.brightnessText}>
                    {UI_MESSAGES.DEBUG_BRIGHTNESS(
                      currentBrightness,
                      currentSeekerInfo,
                    )}
                  </Text>
                  {currentQrInfo && (
                    <Text
                      style={[
                        styles.qrInfoText,
                        currentQrInfo.includes('QR:✓') && styles.qrInfoDetected,
                      ]}
                    >
                      {currentQrInfo}
                    </Text>
                  )}
                  {rectangleInfo && (
                    <Text
                      style={[
                        styles.rectangleInfoText,
                        rectangleInfo.includes('Shape:✓') &&
                          styles.rectangleInfoGood,
                      ]}
                    >
                      {rectangleInfo}
                    </Text>
                  )}
                  {currentBlurInfo && (
                    <Text
                      style={[
                        styles.blurInfoText,
                        currentBlurInfo.includes('Blur:✓') &&
                          styles.blurInfoGood,
                      ]}
                    >
                      {currentBlurInfo}
                    </Text>
                  )}
                </View>
              )}
          </View>
        </>
      )}

      {/* Captured Image Modal */}
      {showCapturedImage && capturedImageUri && (
        <View style={styles.modalContainer}>
          <ScrollView
            style={styles.modalCard}
            contentContainerStyle={styles.modalScrollContent}
          >
            {/* Final result FIRST (top) with border and top margin */}
            <View style={styles.finalResultContainer}>
              <Text style={styles.finalResultLabel}>Végeredmény</Text>
              {capturedQrValue && (
                <Text style={styles.qrValueLabel}>QR: {capturedQrValue}</Text>
              )}
              <View style={styles.finalResultFrame}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${capturedImageUri}` }}
                  style={styles.finalResultImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Arrow and "Folyamat" label */}
            <View style={styles.processArrowContainer}>
              <Text style={styles.processArrow}>↓</Text>
              <Text style={styles.processLabel}>Folyamat</Text>
            </View>

            {/* Original photo without border */}
            {originalPhotoUri && (
              <View style={styles.stepImageContainer}>
                <Text style={styles.stepLabel}>0. Eredeti fotó</Text>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${originalPhotoUri}` }}
                  style={styles.stepImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Processing steps in normal order (from first to last) */}
            {stepImages.map((step, index) => (
              <View key={index} style={styles.stepImageContainer}>
                <Text style={styles.stepLabel}>{step.label}</Text>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${step.image}` }}
                  style={styles.stepImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {/* Share button - KÍVÜL a kártyán */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>
              {UI_MESSAGES.BUTTON_SHARE}
            </Text>
          </TouchableOpacity>

          {/* QR code value - top center */}
          {capturedQrValue && (
            <View style={styles.topQrContainer}>
              <Text style={styles.topQrText}>QR: {capturedQrValue}</Text>
            </View>
          )}

          {/* Close button - KÍVÜL a kártyán */}
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => {
              setShowCapturedImage(false);
              setCapturedImageUri(null);
              setStepImages([]);
              setOriginalPhotoUri(null);
              setDebugCorners(null);
              setSelectedIcons([]);
              setSelectedIconNames([]);
              setBrightnessInfo(null);
              setShowA4Animation(false); // A4 animáció elrejtése
              setA4AnimationImage(null); // A4 kép törlése

              // ÚJ CAPTURE-HEZ ENGEDJÜK ÚJ QR OLVASÁST!
              qrLockRef.current = null;
              qrValueLockRef.current = null; // QR érték lock törlése
              setCapturedQrValue(null); // QR érték törlése
              console.log('🔓 QR unlocked - ready for new scan');
            }}
          >
            <Text style={styles.closeModalButtonText}>
              {UI_MESSAGES.BUTTON_CLOSE}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  switchButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  switchButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  torchButton: {
    position: 'absolute',
    top: 60,
    right: 140,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  torchButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  debugToggleButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  debugToggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  controlsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  toggleButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10,
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '90%',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusDetected: {
    backgroundColor: '#B2FBA5', // Green - all good
  },
  statusWarning: {
    backgroundColor: '#FFEE8C', // Yellow - warning
  },
  statusNotDetected: {
    backgroundColor: '#FF746C', // Red - problem
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  debugImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  debugImage: {
    //transform: [{ rotate: '90deg' }],
    width: '120%',
    height: '120%',
    resizeMode: 'contain',
  },
  brightnessContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 80,
    alignItems: 'center',
  },
  brightnessText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  qrInfoText: {
    color: '#FFEE8C', // Cyan alapértelmezetten (nincs QR)
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  qrInfoDetected: {
    color: '#B2FBA5', // Zöld ha QR kód detektálva - új szín
  },
  rectangleInfoText: {
    color: '#FFEE8C', // Sárga alapértelmezetten (nem szabályos) - új szín
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  rectangleInfoGood: {
    color: '#B2FBA5', // Zöld ha szabályos álló téglalap - új szín
  },
  blurInfoText: {
    color: '#FFEE8C', // Arany színnel jelöljük a blur infót (rossz blur esetén)
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  blurInfoGood: {
    color: '#B2FBA5', // Zöld ha jó a blur - új szín
  },
  calibrationText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 2,
    textAlign: 'center',
  },
  captureButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#B2FBA5',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  captureButtonDebugMode: {
    bottom: 20,
  },
  captureButtonWarning: {
    backgroundColor: '#FFEE8C', // Sárga ha shape nem jó
  },
  captureButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Félátlátszó háttér
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCard: {
    width: '90%',
    height: '70%',
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
  },
  imageSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  capturedImageStyle: {
    width: '80%',
    height: '70%',
    elevation: 10,
  },
  detectedInfoContainer: {
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  detectedIconsSection: {
    marginBottom: 6,
  },
  modalButtonsContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10,
  },
  shareButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 1001,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeModalButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 1001,
  },
  closeModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  topQrContainer: {
    position: 'absolute',
    top: 60,
    left: '50%',
    transform: [{ translateX: -75 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    zIndex: 1001,
  },
  topQrText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  detectedIconsContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 10,
  },
  detectedIconsTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  detectedIconsText: {
    color: 'white',
    fontSize: 12,
  },
  brightnessInfoSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 6,
  },
  brightnessInfoText: {
    color: 'white',
    fontSize: 11,
    marginBottom: 0,
  },
  processingSpinnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent', // Átlátszó háttér
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  processingSpinnerContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Csak a doboz mögött legyen sötét
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
  },
  processingSpinnerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
  },
  stepImageContainer: {
    marginBottom: 30,
    width: '100%',
  },
  stepLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
  },
  stepImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  finalResultContainer: {
    marginTop: 80,
    marginBottom: 30,
    width: '100%',
  },
  finalResultLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 5,
    textAlign: 'center',
  },
  qrValueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  finalResultFrame: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 15,
    alignSelf: 'center',
  },
  finalResultImage: {
    width: '100%',
    height: 'auto',
    aspectRatio: 3 / 5,
    borderRadius: 4,
  },
  processArrowContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  processArrow: {
    fontSize: 48,
    color: '#666',
  },
  processLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
});
