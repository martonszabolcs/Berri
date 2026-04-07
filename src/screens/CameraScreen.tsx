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
import {
  ScanQualityLevels,
  DEFAULT_QUALITY_LEVELS,
  applyScanQualityPreset,
  AdvancedScanSettings,
  DEFAULT_ADVANCED_SETTINGS,
  applyAdvancedOverrides,
} from '../utils/scan/scanConfig';
import {
  loadScanQualitySettings,
  saveScanQualitySettings,
  loadAdvancedSettings,
  saveAdvancedSettings,
} from '../utils/scan/scanSettingsStorage';
import Slider from '@react-native-community/slider';
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
  FlatList,
  Vibration,
  Linking,
  ToastAndroid,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Dirs, FileSystem } from 'react-native-file-access';
import { OpenCV, ObjectType, DataTypes } from 'react-native-fast-opencv';
import { saveScannedDocument } from '../utils/saveImage';
import { useNavigation, useFocusEffect, useIsFocused, CommonActions } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setHistory } from '../store/appSlice';
import { DestinationIcon, ZoomableImage } from '../components';
import Sound from 'react-native-sound';

// Respect silent switch (like native camera shutter)
Sound.setCategory('Ambient');

interface DocumentCorner {
  x: number;
  y: number;
}

// === DETECTION THRESHOLDS ===
const MIN_CONFIDENCE_THRESHOLD = 0.95; // Minimum confidence for auto-capture and "detected" state (növelve)

// === UI TEXTS - CENTRALIZED CONFIGURATION ===
// All user-facing text is defined here in one place
// This makes future text changes and translations easier
const UI_MESSAGES = {
  // Searching / No detection
  SEARCHING: 'Look for the BERRĪ frame',
  SEARCHING_INSTRUCTION:
    'Place the notebook in a well-lit, visible area',

  // Partially visible (low confidence)
  PARTIALLY_VISIBLE: (_confidence: number) => `BERRĪ partially visible`,
  PARTIALLY_INSTRUCTION: 'Try adjusting the angle',

  // Search in progress
  SEARCHING_PROGRESS: (_confidence: number) => `Searching...`,
  SEARCHING_PROGRESS_INSTRUCTION: 'Move the camera over BERRĪ',

  // Move closer
  MOVE_CLOSER: (_confidence: number) => `Move closer`,
  MOVE_CLOSER_INSTRUCTION: 'Move closer to BERRĪ',

  // Detected - without QR code
  DETECTED: (_confidence: number) => `BERRĪ detected!`,
  DETECTED_INSTRUCTION: 'Move closer to BERRĪ',

  // Detected - with QR code (auto capture)
  DETECTED_WITH_QR: (_confidence: number) => `BERRĪ detected!`,
  DETECTED_WITH_QR_INSTRUCTION: 'Hold steady - Auto capturing...',

  // Warning - rectangle shape is bad
  RECTANGLE_WARNING: '  Keep the camera straight!',

  // Warning - blurry image
  BLUR_WARNING: '  Image is blurry!',

  // Warning - low light
  LIGHT_WARNING: '. Turn on the light!',

  // Warning - too steep angle (perspective)
  PERSPECTIVE_WARNING: '  Face the camera straight!',

  // Camera permission
  PERMISSION_TITLE: 'Camera Access Needed',
  PERMISSION_NEEDED:
    'To scan your documents, Berri needs access to your camera. Your photos are processed on-device and never leave your phone.',
  PERMISSION_BUTTON: 'Allow Camera Access',
  PERMISSION_SETTINGS: 'Open Settings',

  // Buttons
  BUTTON_DEBUG_IMAGE: 'Debug mode',
  BUTTON_LIVE_VIEW: 'Live view',
  BUTTON_CAPTURE: 'Capture',
  BUTTON_SHARE: 'Share',
  BUTTON_CLOSE: '✕ Close',

  // Debug info
  DEBUG_BRIGHTNESS: (brightness: number | null, seekerInfo: string | null) =>
    `Brightness: ${brightness !== null ? Math.round(brightness) : '?'} | ${
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
  const dispatch = useAppDispatch();
  const isFocused = useIsFocused();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // === HIDE TAB BAR ON THIS SCREEN ===
  useFocusEffect(
    React.useCallback(() => {
      // Hide tab bar when screen is focused
      const parent = navigation.getParent();
      parent?.setOptions({
        tabBarStyle: { display: 'none' },
      });

      // Show tab bar when leaving screen
      return () => {
        parent?.setOptions({
          tabBarStyle: {
            backgroundColor: 'rgba(37, 37, 68, 1)',
            borderTopWidth: 0,
            height: 70,
            paddingTop: 10,
            display: 'flex',
          },
        });
      };
    }, [navigation])
  );

  // Default DetectionResult - initialization to avoid lag
  const defaultDetectionResult: DetectionResult = {
    corners: [],
    confidence: 0,
    brightness: 0,
    seekerInfo: 'Starting...',
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
    'Hold still',
  );
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [zoomCapturedImage, setZoomCapturedImage] = useState<string | null>(null);
  const [capturedQrValue, setCapturedQrValue] = useState<string | null>(null); // QR kód érték a végeredményhez
  
  // === MULTI-IMAGE COLLECTION ===
  // Collected images for multi-page document
  interface ScanParams {
    frameCorners: { x: number; y: number }[];
    processedCorners: { x: number; y: number }[];
    qrValue: string | null;
    qrPosition: 'left' | 'right' | null;
    qrBounds: { left: number; top: number; width: number; height: number } | null;
    photoWidth: number;
    photoHeight: number;
    frameWidth: number;
    frameHeight: number;
    frameBrightness: number;
  }
  interface CapturedImage {
    id: string;
    imageBase64: string;
    fileUri: string;
    qrValue: string | null;
    qrPosition: 'left' | 'right' | null;
    timestamp: number;
    selectedIcons: number[];
    rawPhotoPath: string; // Path to original raw photo in cache
    scanParams: ScanParams; // Params needed to re-scan
  }
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const showGalleryModalRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    showGalleryModalRef.current = showGalleryModal;
  }, [showGalleryModal]);

  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [isGalleryZoomed, setIsGalleryZoomed] = useState(false);

  // === SCAN QUALITY TUNING ===
  const [showTunePanel, setShowTunePanel] = useState(false);
  const [tuneBlackLevel, setTuneBlackLevel] = useState(5);
  const [tuneColorLevel, setTuneColorLevel] = useState(5);
  const [isTuneRescanning, setIsTuneRescanning] = useState(false);
  const [isFirstTimeTuning, setIsFirstTimeTuning] = useState(false);
  const tuneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleryFlatListRef = useRef<FlatList>(null);
  const isFirstTimeScanRef = useRef(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedScanSettings>({ ...DEFAULT_ADVANCED_SETTINGS });
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Load saved scan quality settings on mount
  useEffect(() => {
    loadScanQualitySettings().then(({ levels, isFirstTime }) => {
      setTuneBlackLevel(levels.blackLevel);
      setTuneColorLevel(levels.colorLevel);
      isFirstTimeScanRef.current = true;
    });
    loadAdvancedSettings().then(adv => setAdvancedSettings(adv));
  }, []);
  
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
  const [debugImagesEnabled, setDebugImagesEnabled] = useState(false); // Debug step images on/off - FALSE for speed!

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

  // Thumbnail scroll ref for smooth animation
  const thumbnailScrollRef = useRef<ScrollView>(null);

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

  // Pre-warm FileSystem and Share modules to avoid first-use delay
  useEffect(() => {
    const prewarm = async () => {
      try {
        // Pre-warm FileSystem by checking if cache dir exists
        const cacheExists = await FileSystem.exists(Dirs.CacheDir);
        console.log('📦 FileSystem pre-warmed, cache exists:', cacheExists);
      } catch (e) {
        // Ignore errors - this is just pre-warming
      }
    };
    prewarm();
  }, []);

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
        return { isGood: false, message: 'Shape:⚠️ Not 4 corners' };
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
          message: `Shape:⚠️ Corner folded or too close`,
        };
      }

      // Átlók aránya - egy téglalapnál kb egyforma hosszúak
      const diagonalRatio =
        Math.max(diagonal1, diagonal2) / Math.min(diagonal1, diagonal2);
      if (diagonalRatio > 1.3) {
        return {
          isGood: false,
          message: `Shape:⚠️ Bad diagonal ratio (${diagonalRatio.toFixed(2)})`,
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
          message: `Shape:✓ Upright rectangle (${aspectRatio.toFixed(2)})`,
        };
      } else if (sidesGood) {
        return {
          isGood: false,
          message: `Shape:⚠️ Rectangle but wrong angle (${aspectRatio.toFixed(
            2,
          )})`,
        };
      }
      return {
        isGood: false,
        message: `Shape:⚠️ Not a rectangle (H:${horizontalRatio.toFixed(
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
      setCurrentBrightness(prev => result.brightness !== prev ? result.brightness! : prev);
      if (result.seekerInfo)
        setCurrentSeekerInfo(prev => result.seekerInfo !== prev ? result.seekerInfo! : prev);
      if (result.blurInfo)
        setCurrentBlurInfo(prev => result.blurInfo !== prev ? result.blurInfo! : prev);
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
    // Don't capture while gallery modal is open
    if (showGalleryModalRef.current) {
      return;
    }

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
      setCaptureStatusMessage('Hold still');

      // === TÖBBSZÖRI FOTÓZÁS BLUR ÉS DETECTION MIATT ===
      // Maximum 5 fotót próbálunk, amíg nem lesz éles ÉS sikeres corner detection
      const MAX_PHOTO_ATTEMPTS = 5;
      const BLUR_THRESHOLD = 2.5; // Laplacian stddev küszöb - 2.5 alatt homályos

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
        setCaptureStatusMessage(photoAttempt === 1 ? 'Hold still' : 'Retrying...');

        // Fotó készítése
        const photo = await camera.current.takePhoto({
          enableShutterSound: false,
        });

        console.log(`📸 Photo ${photoAttempt} taken:`, photo);

        photoBase64 = await FileSystem.readFile(photo.path, 'base64');
        photoSize = { width: photo.width, height: photo.height };
        // Fotó méretének lekérdezése

        // === ELŐSZÖR KIVÁGÁS, AZTÁN BLUR ELLENŐRZÉS ===
        // A blur-t a kivágott dokumentumon ellenőrizzük, nem az eredeti fotón
        console.log('🔍 Attempting corner detection and crop...');
        setCaptureStatusMessage('Cropping document...');

        // Várunk egy kicsit hogy látható legyen az üzenet
        await new Promise<void>(resolve => setTimeout(resolve, 200));

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

        // Ha NEM sikerült a kivágás, újra próbálkozunk
        if (!scanResult.success || !scanResult.imageBase64) {
          console.log(
            `⚠️ Photo ${photoAttempt} corner detection failed. Retrying...`,
          );
          
          if (photoAttempt === MAX_PHOTO_ATTEMPTS) {
            const failReason = scanResult?.error || 'Corner detection failed';
            console.warn(
              `⚠️ Failed after ${MAX_PHOTO_ATTEMPTS} attempts (detection failed). Reason: ${failReason}`,
            );
            ToastAndroid.show(
              `Scan failed: ${failReason}`,
              ToastAndroid.LONG,
            );
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
          continue;
        }

        // === BLUR ELLENŐRZÉS KIKAPCSOLVA ===
        // A kamera autofokusszal és exposure={-0.5} gyors záridővel dolgozik.
        // mean(|Laplacian|) nem működik fehér/kevés tartalmú lapokon (mindig alacsony).
        // Ha a fotó homályos, a user látja az előnézeten és újra fotóz.
        finalBlurScore = 99; // Always pass
        const isBlurry = false;

        console.log(`📊 Attempt ${photoAttempt} results:`, {
          detectionSuccess: scanResult.success,
        });

        // Ha sikeres detection, kész vagyunk!
        console.log(
          `✅ Photo ${photoAttempt} is good! Blur: ${finalBlurScore.toFixed(
            2,
          )}, Detection: OK`,
        );
        setCaptureStatusMessage('Processing...');
        break;
      }

      console.log('🔍 QR data being passed to scanDocument:', {
        captureQrValue,
        captureQrPosition,
        captureQrBounds,
      });

      // scanResult már megvan a loop-ból

      console.log(`📊 Final results:`, {
        blur: finalBlurScore.toFixed(2),
        detectionSuccess: scanResult?.success,
      });

      // Ha végül sem sikerült a detection
      if (!scanResult || !scanResult.success) {
        const failReason = scanResult?.error || 'Detection returned no result';
        console.warn(
          `⚠️ Photo detection failed - reason: ${failReason}`,
        );
        ToastAndroid.show(
          `Scan failed: ${failReason}`,
          ToastAndroid.LONG,
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
        return;
      }

      // Sikeres scan - folytatjuk az animációval

      if (scanResult.success && scanResult.imageBase64) {
        // Play success sound immediately
        const shutterSound = new Sound('ios_photo.mp3', Sound.MAIN_BUNDLE, (error) => {
          if (!error) {
            shutterSound.setVolume(1.0);
            shutterSound.play(() => shutterSound.release());
          }
        });

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

        // Animáció: a thumbnail stripbe csúszik be smooth-an
        // A thumbnail strip bottom: 100px, kb 120px magas (thumbnails + continue gomb)
        // Célpont: a thumbnail sor közepe
        const a4Ratio = 1.414;
        const a4Width = screenWidth * 0.85;
        const a4Height = a4Width * a4Ratio;
        const startY = (screenHeight - a4Height) / 2;
        const targetY = screenHeight - 30; // thumbnail strip középpontja (~100 + 80 padding/content)
        const targetScale = 60 / a4Width; // Scale to thumbnail size (60px width)
        
        Animated.parallel([
          Animated.timing(a4Scale, {
            toValue: targetScale,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(a4TranslateY, {
            toValue: targetY - startY,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(a4Opacity, {
            toValue: 0,
            duration: 400,
            delay: 300, // Fade out near the end
            useNativeDriver: true,
          }),
        ]).start();

        // Várunk az animációra (500ms) + kis extra
        await new Promise<void>(resolve => setTimeout(resolve, 600));

        // === MULTI-IMAGE: Add image to collection instead of showing modal ===
        const imageId = `img_${Date.now()}`;
        const tempDir = `${Dirs.CacheDir}/gallery_preview`;
        const tempDirExists = await FileSystem.exists(tempDir);
        if (!tempDirExists) {
          await FileSystem.mkdir(tempDir);
        }
        const tempUri = `${tempDir}/${imageId}.jpg`;
        await FileSystem.writeFile(tempUri, scanResult.imageBase64, 'base64');

        // Save raw photo to cache for re-scanning (tune feature)
        const rawDir = `${Dirs.CacheDir}/raw_photos`;
        const rawDirExists = await FileSystem.exists(rawDir);
        if (!rawDirExists) {
          await FileSystem.mkdir(rawDir);
        }
        const rawPhotoPath = `${rawDir}/${imageId}_raw.jpg`;
        await FileSystem.writeFile(rawPhotoPath, photoBase64, 'base64');

        const newImage: CapturedImage = {
          id: imageId,
          imageBase64: scanResult.imageBase64,
          fileUri: `file://${tempUri}`,
          qrValue: scanResult.qrValue || null,
          qrPosition: captureQrPosition || null,
          timestamp: Date.now(),
          selectedIcons: scanResult.selectedIcons || [],
          rawPhotoPath,
          scanParams: {
            frameCorners: captureFrameCorners,
            processedCorners: captureProcessedCorners,
            qrValue: captureQrValue || null,
            qrPosition: captureQrPosition || null,
            qrBounds: captureQrBounds || null,
            photoWidth: photoSize.width,
            photoHeight: photoSize.height,
            frameWidth: captureFrameWidth,
            frameHeight: captureFrameHeight,
            frameBrightness: captureBrightness,
          },
        };
        setCapturedImages(prev => {
          const updated = [...prev, newImage];
          // Limit to 20 images to prevent memory issues
          if (updated.length > 20) updated.shift();
          return updated;
        });

        // Auto-open gallery modal on first ever scan
        if (isFirstTimeScanRef.current) {
          setGalleryStartIndex(0);
          setShowGalleryModal(true);
          showGalleryModalRef.current = true; // Update ref immediately for finally block
          setIsFrameProcessorActive(false);
        }
        
        // Reset for next capture - NO MODAL
        setCapturedImageUri(null);
        setCapturedQrValue(null);
        setOriginalPhotoUri(null);
        setDebugCorners(null);
        setSelectedIcons([]);
        setSelectedIconNames([]);
        setBrightnessInfo(null);
        setShowA4Animation(false);
        setA4AnimationImage(null);
        
        // Reset QR lock for new scan
        qrLockRef.current = null;
        qrValueLockRef.current = null;
        
        // Reset auto-capture flag for next photo
        autoCaptureTriggeredRef.current = false;
        autoCaptureTimerRef.current = null;
        
        console.log('📸 Image added to collection. Total:', capturedImages.length + 1);
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      ToastAndroid.show(
        `Capture error: ${error instanceof Error ? error.message : String(error)}`,
        ToastAndroid.LONG,
      );
    } finally {
      setIsCapturing(false);
      setIsCaptureAnimating(false);

      // Reset animáció értékek
      overlayScale.setValue(1);
      overlayTranslateY.setValue(0);
      overlayOpacity.setValue(1);

      // Reset auto-capture for next attempt
      autoCaptureTriggeredRef.current = false;
      autoCaptureTimerRef.current = null;

      // 🟢 START: Indítsuk újra a frame processor-t (csak ha nincs gallery modal nyitva)!
      if (!showGalleryModalRef.current) {
        console.log('▶️ Resuming frame processor');
        setIsFrameProcessorActive(true);
      } else {
        console.log('⏸️ Gallery modal open - frame processor stays paused');
      }
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
    capturedImages.length,
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
      const detectedIcons = selectedIcons.map(i => i + 1);
      (navigation as any).navigate('DestinationSelectScreen', {
        savedFilePath: savedPath,
        destinationType: detectedIcons.length > 0 ? detectedIcons : [1],
      });
    }

    try {
      // Save the base64 image to a temporary file
      const tempPath = `${Dirs.CacheDir}/captured_document.jpg`;

      await FileSystem.writeFile(tempPath, capturedImageUri, 'base64');

    
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
      //hasQrValue && // QR KÓD KELL AZ AUTO-CAPTURE-HEZ! - KIKAPCSOLVA, QR NÉLKÜL IS FOTÓZ
      !stableIsBlurry && // STABIL BLUR ELLENŐRZÉS - BEKAPCSOLVA!
      !isCapturing &&
      !isCaptureAnimating &&
      !showCapturedImage &&
      !showGalleryModal &&
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
              //finalHasQrValue && // QR KÓD KELL!
              !stableIsBlurry && // STABIL BLUR ELLENŐRZÉS - BEKAPCSOLVA!
              !isCapturing &&
              !isCaptureAnimating &&
              !showCapturedImage &&
              !showGalleryModal;

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
    showGalleryModal,
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
  const getCurrentStatus = useMemo(() => {
    // Use smoothed results instead of raw results for stability
    if (smoothedResults.length === 0) {
      const earlyLightWarning = (currentBrightness !== null && currentBrightness < 60) ? UI_MESSAGES.LIGHT_WARNING : '';
      return {
        isDetected: stableDetectionStatus.isDetected, // Use stable status
        isRectangleGood: true,
        message: UI_MESSAGES.SEARCHING,
        instruction: UI_MESSAGES.SEARCHING_INSTRUCTION + earlyLightWarning,
      };
    }

    const latestResult = smoothedResults[0]; // Use smoothed results
    let confidence = latestResult.confidence;

    // QR kód ellenőrzés - ZÁROLT vagy friss érték
    const qrVal = qrValueLockRef.current || latestResult?.qrValue;
    const hasRealQrValue = typeof qrVal === 'string' && qrVal.length > 0;

    // BLUR ELLENŐRZÉS - használjuk a stabil verzió
    const blurWarning = stableIsBlurry ? UI_MESSAGES.BLUR_WARNING : '';

    // FÉNY ELLENŐRZÉS - alacsony fénynél figyelmeztetés
    const lightWarning = (currentBrightness !== null && currentBrightness < 50) ? UI_MESSAGES.LIGHT_WARNING : '';

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
            perspectiveWarning +
            lightWarning,
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
          UI_MESSAGES.PARTIALLY_INSTRUCTION + blurWarning + perspectiveWarning + lightWarning,
      };
    }

    return {
      isDetected: false,
      isRectangleGood: true,
      message: UI_MESSAGES.SEARCHING_PROGRESS(confidence),
      instruction:
        UI_MESSAGES.SEARCHING_PROGRESS_INSTRUCTION +
        blurWarning +
        perspectiveWarning +
        lightWarning,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smoothedResults, stableDetectionStatus, stableIsBlurry, currentBrightness]);

  const currentStatus = getCurrentStatus;

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

    // Determine overlay color and style - Purple theme to match app
    const COLORS = { GREEN: '#C4A8FF', YELLOW: '#FFF52E', RED: '#FF746C' }; // Purple instead of green

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
      <View style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.permissionLogo}
            resizeMode="contain"
          />

          <View style={styles.permissionIconCircle}>
            <Image
              source={require('../assets/new_scan.png')}
              style={styles.permissionIcon}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.permissionTitle}>
            {UI_MESSAGES.PERMISSION_TITLE}
          </Text>
          <Text style={styles.permissionDescription}>
            {UI_MESSAGES.PERMISSION_NEEDED}
          </Text>

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionButtonText}>
              {UI_MESSAGES.PERMISSION_BUTTON}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permissionSettingsButton}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.permissionSettingsText}>
              {UI_MESSAGES.PERMISSION_SETTINGS}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // === SCAN QUALITY TUNE: Re-scan handler ===
  const handleTuneRescan = async (
    blackLevel: number,
    colorLevel: number,
    currentIndex: number,
    advOverrides: AdvancedScanSettings,
  ) => {
    const img = capturedImages[currentIndex];
    if (!img) return;

    setIsTuneRescanning(true);
    try {
      // Apply simple preset first
      applyScanQualityPreset({ blackLevel, colorLevel });
      // Apply advanced overrides only if any are set (non-null)
      const hasOverrides = Object.values(advOverrides).some(v => v !== null);
      if (hasOverrides) {
        applyAdvancedOverrides(advOverrides);
      }

      // Read raw photo from cache
      const rawBase64 = await FileSystem.readFile(img.rawPhotoPath, 'base64');

      const result = await scanDocument({
        rawImageBase64: rawBase64,
        frameCorners: img.scanParams.frameCorners,
        processedCorners: img.scanParams.processedCorners,
        currentQrValue: img.scanParams.qrValue,
        currentQrPosition: img.scanParams.qrPosition,
        qrBounds: img.scanParams.qrBounds,
        photoWidth: img.scanParams.photoWidth,
        photoHeight: img.scanParams.photoHeight,
        frameWidth: img.scanParams.frameWidth,
        frameHeight: img.scanParams.frameHeight,
        frameBrightness: img.scanParams.frameBrightness,
        enableDebugImages: false,
      });

      if (result.success && result.imageBase64) {
        // Update preview file
        const tempDir = `${Dirs.CacheDir}/gallery_preview`;
        const tempUri = `${tempDir}/${img.id}.jpg`;
        await FileSystem.writeFile(tempUri, result.imageBase64, 'base64');

        // Update image in state
        setCapturedImages(prev =>
          prev.map(p =>
            p.id === img.id
              ? {
                  ...p,
                  imageBase64: result.imageBase64!,
                  fileUri: `file://${tempUri}?t=${Date.now()}`,
                  selectedIcons: result.selectedIcons || p.selectedIcons,
                }
              : p,
          ),
        );
      }
    } catch (e) {
      console.warn('Tune re-scan failed:', e);
    } finally {
      setIsTuneRescanning(false);
    }
  };

  // Debounced tune change handler (preview only, no auto-save)
  const handleTuneSliderChange = (
    blackLevel: number,
    colorLevel: number,
    currentIndex: number,
    advOverrides: AdvancedScanSettings,
  ) => {
    if (tuneDebounceRef.current) {
      clearTimeout(tuneDebounceRef.current);
    }
    tuneDebounceRef.current = setTimeout(() => {
      handleTuneRescan(blackLevel, colorLevel, currentIndex, advOverrides);
    }, 400);
  };

  // Advanced slider change → re-scan with debounce
  const handleAdvancedChange = (key: keyof AdvancedScanSettings, value: number) => {
    const updated = { ...advancedSettings, [key]: value };
    setAdvancedSettings(updated);
    if (tuneDebounceRef.current) clearTimeout(tuneDebounceRef.current);
    tuneDebounceRef.current = setTimeout(() => {
      handleTuneRescan(tuneBlackLevel, tuneColorLevel, galleryStartIndex, updated);
    }, 400);
  };

  // Explicit save handler for tune panel
  const handleTuneSave = async () => {
    // Cancel any pending re-scan
    if (tuneDebounceRef.current) {
      clearTimeout(tuneDebounceRef.current);
      tuneDebounceRef.current = null;
    }
    setIsTuneRescanning(false);
    await saveScanQualitySettings({ blackLevel: tuneBlackLevel, colorLevel: tuneColorLevel });
    await saveAdvancedSettings(advancedSettings);
    isFirstTimeScanRef.current = false;
    setIsFirstTimeTuning(false);
    setShowTunePanel(false);
    setShowGalleryModal(false);
    setIsFrameProcessorActive(true);
  };

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
                isActive={isFocused && !showCapturedImage}
                exposure={-0.5}
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

          {/* Torch (és vaku) gomb */}
          <TouchableOpacity
            style={[styles.torchButton]}
            onPress={() => setTorchEnabled(!torchEnabled)}
          >
            <Text style={styles.torchButtonText}>
              {torchEnabled ? '🔦' : '🔦'}
            </Text>
          </TouchableOpacity>

          {/* Vissza gomb - bal felső sarok */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (navigation as any).navigate('History')}
          >
            <Image
              source={require('../assets/left_arrow.png')}
              style={styles.backButtonIcon}
              resizeMode="contain"
            />
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
          {!isFrameProcessorActive && !showA4Animation && !showGalleryModal && (
            <View style={styles.processingSpinnerOverlay}>
              <View style={styles.processingSpinnerContainer}>
                <ActivityIndicator size="large" color="#C4A8FF" />
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

          {/* === THUMBNAIL STRIP & CONTINUE BUTTON === */}
          {capturedImages.length > 0 && (
            <View style={styles.thumbnailStripContainer}>
              {/* Thumbnail row */}
              <ScrollView 
                ref={thumbnailScrollRef}
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailScrollContent}
                onContentSizeChange={() => {
                  // Auto-scroll to end when new image is added
                  thumbnailScrollRef.current?.scrollToEnd({ animated: true });
                }}
              >
                {capturedImages.map((img, index) => (
                  <TouchableOpacity
                    key={img.id}
                    style={styles.thumbnailWrapper}
                    onPress={() => {
                      if (isCapturing || isCaptureAnimating) return;
                      setGalleryStartIndex(index);
                      setShowGalleryModal(true);
                      setIsFrameProcessorActive(false);
                    }}
                  >
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${img.imageBase64}` }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                    <View style={styles.thumbnailBadge}>
                      <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* Send & Save buttons - below thumbnails */}
              <View style={styles.continueButtonRow}>
                <TouchableOpacity
                  style={[styles.continueButton, styles.saveButton]}
                  onPress={async () => {
                    if (capturedImages.length === 0) return;
                    
                    try {
                      const savedPaths: string[] = [];
                      
                      for (const image of capturedImages) {
                        const savedPath = await saveScannedDocument(image.imageBase64, settings);
                        if (savedPath) {
                          savedPaths.push(savedPath);
                        }
                      }
                      
                      if (savedPaths.length > 0) {
                        // Save to history
                        const history = await AsyncStorage.getItem('history');
                        const historyArray = history ? JSON.parse(history) : [];
                        const newEntry = {
                          timestamp: Date.now(),
                          files: savedPaths.map(filePath => ({
                            url: filePath.split('/').pop() || 'unknown_file',
                            filename: filePath.split('/').pop() || 'unknown_file',
                          })),
                          destinations: [],
                        };
                        historyArray.push(newEntry);
                        await AsyncStorage.setItem('history', JSON.stringify(historyArray));
                        dispatch(setHistory(historyArray));
                        
                        setCapturedImages([]);
                        
                        // Navigate to History tab
                        const parentNavigation = navigation.getParent();
                        if (parentNavigation) {
                          navigation.dispatch(
                            CommonActions.reset({
                              index: 0,
                              routes: [{ name: 'CameraScreen' }],
                            })
                          );
                          parentNavigation.navigate('History');
                        }
                      }
                    } catch (error) {
                      console.error('Error saving documents:', error);
                    }
                  }}
                >
                  <Text style={styles.continueButtonText}>
                    Save
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={async () => {
                    if (capturedImages.length === 0) return;
                    
                    try {
                      const savedPaths: string[] = [];
                      
                      for (const image of capturedImages) {
                        const savedPath = await saveScannedDocument(image.imageBase64, settings);
                        if (savedPath) {
                          savedPaths.push(savedPath);
                        }
                      }
                      
                      if (savedPaths.length > 0) {
                        setCapturedImages([]);
                        
                        const allDetectedIcons = [...new Set(
                          capturedImages.flatMap(img => img.selectedIcons.map(i => i + 1))
                        )];
                        
                        (navigation as any).navigate('DestinationSelectScreen', {
                          savedFilePaths: savedPaths,
                          destinationType: allDetectedIcons.length > 0 ? allDetectedIcons : [1],
                        });
                      }
                    } catch (error) {
                      console.error('Error saving documents:', error);
                    }
                  }}
                >
                  <Text style={styles.continueButtonText}>
                    Send
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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
              <Text style={styles.finalResultLabel}>Final Result</Text>
              {capturedQrValue && (
                <Text style={styles.qrValueLabel}>QR: {capturedQrValue}</Text>
              )}
              <View style={styles.finalResultFrame}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setZoomCapturedImage(`data:image/jpeg;base64,${capturedImageUri}`)}
                >
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${capturedImageUri}` }}
                    style={{ width: screenWidth - 80, height: (screenWidth - 80) * (5 / 3) }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Arrow and "Process" label */}
            <View style={styles.processArrowContainer}>
              <Text style={styles.processArrow}>↓</Text>
              <Text style={styles.processLabel}>Process</Text>
            </View>

            {/* Original photo without border */}
            {originalPhotoUri && (
              <View style={styles.stepImageContainer}>
                <Text style={styles.stepLabel}>0. Original Photo</Text>
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
              console.log('🔄 FULL RESET - Starting fresh capture session');
              
              // === 1. MODAL & IMAGE STATES ===
              setShowCapturedImage(false);
              setCapturedImageUri(null);
              setStepImages([]);
              setOriginalPhotoUri(null);
              setDebugCorners(null);
              setSelectedIcons([]);
              setSelectedIconNames([]);
              setBrightnessInfo(null);
              setShowA4Animation(false);
              setA4AnimationImage(null);

              // === 2. CAPTURE STATES ===
              setIsCapturing(false);
              setIsCaptureAnimating(false);
              setCaptureStatusMessage('Hold still');
              
              // === 3. FRAME PROCESSOR ===
              setIsFrameProcessorActive(true);

              // === 4. DETECTION STATES - CRITICAL! ===
              setSmoothedResults([]); // Clear detection buffer!
              setStableDetectionStatus({
                isDetected: false,
                consecutiveDetected: 0,
                consecutiveNotDetected: 0,
              });
              setStableIsBlurry(false);

              // === 5. QR STATES ===
              qrLockRef.current = null;
              qrValueLockRef.current = null;
              setCapturedQrValue(null);

              // === 6. AUTO-CAPTURE STATES ===
              if (autoCaptureTimerRef.current) {
                clearTimeout(autoCaptureTimerRef.current);
                autoCaptureTimerRef.current = null;
              }
              autoCaptureTriggeredRef.current = false;

              // === 7. ANIMATION VALUES ===
              overlayScale.setValue(1);
              overlayTranslateY.setValue(0);
              overlayOpacity.setValue(1);
              a4Scale.setValue(1);
              a4TranslateY.setValue(0);
              a4Opacity.setValue(1);

              console.log('✅ FULL RESET COMPLETE - Ready for new scan');
            }}
          >
            <Text style={styles.closeModalButtonText}>
              {UI_MESSAGES.BUTTON_CLOSE}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* === FULLSCREEN GALLERY MODAL === */}
      {showGalleryModal && capturedImages.length > 0 && (
        <GestureHandlerRootView style={styles.galleryModalContainer}
          onLayout={() => {
            if (isFirstTimeScanRef.current) {
              setShowTunePanel(true);
              setIsFirstTimeTuning(true);
              isFirstTimeScanRef.current = false;
            }
          }}
        >
          {/* Header */}
          <View style={styles.galleryHeader}>
            {!isFirstTimeTuning ? (
              <TouchableOpacity
                style={styles.galleryCloseButton}
                onPress={() => {
                  setShowGalleryModal(false);
                  setShowTunePanel(false);
                  setIsFrameProcessorActive(true);
                }}
              >
                <Text style={styles.galleryCloseText}>✕</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.galleryCloseButton} />
            )}
            {isFirstTimeTuning && (
              <Text style={styles.tuneFirstTimeTitle}>Set up scan quality</Text>
            )}
            {!isFirstTimeTuning && capturedImages.length > 0 && (
              <TouchableOpacity
                style={styles.galleryHeaderDeleteButton}
                onPress={() => {
                  const currentImage = capturedImages[galleryStartIndex];
                  if (!currentImage) return;
                  const newImages = capturedImages.filter(img => img.id !== currentImage.id);
                  setCapturedImages(newImages);
                  if (newImages.length === 0) {
                    setShowGalleryModal(false);
                    setIsFrameProcessorActive(true);
                  } else if (galleryStartIndex >= newImages.length) {
                    setGalleryStartIndex(newImages.length - 1);
                  }
                }}
              >
                <Image
                  resizeMode="contain"
                  source={require('../assets/trash.png')}
                  style={styles.galleryHeaderDeleteIcon}
                />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.galleryScrollView}
            contentContainerStyle={styles.galleryScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          {/* Swipeable gallery */}
          <FlatList
            ref={galleryFlatListRef}
            data={capturedImages}
            horizontal
            pagingEnabled
            scrollEnabled={!isGalleryZoomed}
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={{ height: screenHeight * 0.55 }}
            initialScrollIndex={galleryStartIndex}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setGalleryStartIndex(newIndex);
            }}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => (
              <View style={[styles.galleryImageContainer, { width: screenWidth }]}>
                <View style={styles.zoomScrollContent}>
                  <ZoomableImage
                    uri={item.fileUri}
                    width={screenWidth * 0.85}
                    height={screenHeight * 0.4}
                    onZoomChange={(zoomed) => setIsGalleryZoomed(zoomed)}
                  />
                  {/* Re-scan loading overlay */}
                  {isTuneRescanning && (
                    <View style={styles.tuneRescanOverlay}>
                      <ActivityIndicator size="small" color="#C4A8FF" />
                    </View>
                  )}
                </View>
                {/* Page indicator */}
                <View style={styles.galleryPageIndicator}>
                  <Text style={styles.galleryPageText}>
                    {index + 1} / {capturedImages.length}
                  </Text>
                </View>
                {/* Selected Icons */}
                <View style={styles.galleryIconRow}>
                  {['Nyíl', 'Gyémánt', 'Alma', 'Csengő', 'Lóhere', 'Csillag', 'Patkó'].map((name, i) => (
                    <View key={i} style={[
                      styles.galleryIconItem,
                      item.selectedIcons?.includes(i) && styles.galleryIconItemActive,
                    ]}>
                      <DestinationIcon
                        type={(i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7}
                        variant={item.selectedIcons?.includes(i) ? 'history-active' : 'history'}
                        size={28}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
          />

          {/* === TUNE PANEL (always visible) === */}
          <View style={styles.tunePanelArea}>
            {isFirstTimeTuning && (
              <Text style={styles.tuneFirstTimeHint}>
                Adjust the sliders to match your writing style, then tap Save
              </Text>
            )}

            <View style={styles.tuneSlidersContainer}>
                  <View style={styles.tuneSliderRow}>
                    <View style={styles.tuneSliderHeader}>
                      <View style={styles.tuneLabelWithInfo}>
                        <Text style={styles.tuneSliderLabel}>Black ink</Text>
                        <TouchableOpacity onPress={() => setActiveTooltip(activeTooltip === 'black' ? null : 'black')}>
                          <Text style={styles.tuneInfoButton}>ⓘ</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.tuneSliderValue}>{tuneBlackLevel}</Text>
                    </View>
                    {activeTooltip === 'black' && (
                      <Text style={styles.tooltipText}>Controls how strongly black/dark writing is detected. Higher = picks up faint pencil marks and small dots. Lower = only strong, clear lines.</Text>
                    )}
                    <Slider
                      style={styles.tuneSlider}
                      minimumValue={1}
                      maximumValue={10}
                      step={1}
                      value={tuneBlackLevel}
                      onValueChange={(val: number) => {
                        setTuneBlackLevel(val);
                        handleTuneSliderChange(val, tuneColorLevel, galleryStartIndex, advancedSettings);
                      }}
                      minimumTrackTintColor="#C4A8FF"
                      maximumTrackTintColor="rgba(255,255,255,0.15)"
                      thumbTintColor="#FFFFFF"
                    />
                  </View>

                  <View style={styles.tuneSliderRow}>
                    <View style={styles.tuneSliderHeader}>
                      <View style={styles.tuneLabelWithInfo}>
                        <Text style={styles.tuneSliderLabel}>Color ink</Text>
                        <TouchableOpacity onPress={() => setActiveTooltip(activeTooltip === 'color' ? null : 'color')}>
                          <Text style={styles.tuneInfoButton}>ⓘ</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.tuneSliderValue}>{tuneColorLevel}</Text>
                    </View>
                    {activeTooltip === 'color' && (
                      <Text style={styles.tooltipText}>Controls how strongly colored writing is detected (pens, highlighters, stamps). Higher = picks up faint or pastel colors. Lower = only vivid, saturated colors.</Text>
                    )}
                    <Slider
                      style={styles.tuneSlider}
                      minimumValue={1}
                      maximumValue={15}
                      step={1}
                      value={tuneColorLevel}
                      onValueChange={(val: number) => {
                        setTuneColorLevel(val);
                        handleTuneSliderChange(tuneBlackLevel, val, galleryStartIndex, advancedSettings);
                      }}
                      minimumTrackTintColor="#C4A8FF"
                      maximumTrackTintColor="rgba(255,255,255,0.15)"
                      thumbTintColor="#FFFFFF"
                    />
                  </View>

              {/* Divider between basic and advanced */}
              <View style={styles.tuneDivider} />

              {/* === ADVANCED SLIDERS === */}
              <View style={styles.advancedPanel}>
                  {[
                    { key: 'detailSensitivity' as const, label: 'Detail sensitivity', info: 'How much fine detail to capture — faint pencil marks, small dots, thin lines.' },
                    { key: 'lightStrokeCapture' as const, label: 'Light stroke capture', info: 'Keep faint or light strokes that are barely visible. Higher = keeps lighter marks.' },
                    { key: 'outputDarkness' as const, label: 'Output darkness', info: 'How dark the ink appears in the final result. Higher = darker, bolder output.' },
                    { key: 'colorDetection' as const, label: 'Color detection', info: 'How easily colored writing is detected. Higher = catches faint or pastel colors too.' },
                    { key: 'darkColorCapture' as const, label: 'Dark color capture', info: 'Keep dark-colored writing like dark blue, brown, or dark green. Higher = keeps more.' },
                    { key: 'paperTolerance' as const, label: 'Paper tolerance', info: 'Handle off-white, cream, or yellowed paper. Higher = more tolerant of non-white backgrounds.' },
                    { key: 'largeColorAreas' as const, label: 'Large color areas', info: 'Keep large uniformly-colored elements like stickers, stamps, or logos. 1 = off, 5+ = recommended.' },
                  ].map(param => {
                    const val = advancedSettings[param.key];
                    const displayVal = val !== null ? String(val) : 'auto';
                    return (
                      <View key={param.key} style={styles.advancedRow}>
                        <View style={styles.tuneSliderHeader}>
                          <View style={styles.tuneLabelWithInfo}>
                            <Text style={styles.advancedLabel}>{param.label}</Text>
                            <TouchableOpacity onPress={() => setActiveTooltip(activeTooltip === param.key ? null : param.key)}>
                              <Text style={styles.tuneInfoButton}>ⓘ</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={[styles.tuneSliderValue, val === null && styles.advancedAutoText]}>
                            {displayVal}
                          </Text>
                        </View>
                        {activeTooltip === param.key && (
                          <Text style={styles.tooltipText}>{param.info}</Text>
                        )}
                        <Slider
                          style={styles.tuneSlider}
                          minimumValue={1}
                          maximumValue={10}
                          step={1}
                          value={val ?? 5}
                          onValueChange={(v: number) => handleAdvancedChange(param.key, v)}
                          minimumTrackTintColor="rgba(196, 168, 255, 0.5)"
                          maximumTrackTintColor="rgba(255,255,255,0.1)"
                          thumbTintColor="#C4A8FF"
                        />
                      </View>
                    );
                  })}
              </View>


            </View>
          </View>
          </ScrollView>

          {/* Sticky bottom buttons */}
          <View style={styles.tuneStickyButtons}>
              <View style={styles.tuneButtonsRow}>
                <TouchableOpacity
                  style={styles.tuneResetButton}
                  onPress={() => {
                    setTuneBlackLevel(DEFAULT_QUALITY_LEVELS.blackLevel);
                    setTuneColorLevel(DEFAULT_QUALITY_LEVELS.colorLevel);
                    setAdvancedSettings({ ...DEFAULT_ADVANCED_SETTINGS });
                    handleTuneSliderChange(
                      DEFAULT_QUALITY_LEVELS.blackLevel,
                      DEFAULT_QUALITY_LEVELS.colorLevel,
                      galleryStartIndex,
                      { ...DEFAULT_ADVANCED_SETTINGS },
                    );
                  }}
                >
                  <Text style={styles.tuneResetText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tuneSaveButton}
                  onPress={handleTuneSave}
                >
                  <Text style={styles.tuneSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
          </View>
        </GestureHandlerRootView>
      )}
      {zoomCapturedImage && (
        <View style={styles.zoomOverlay}>
          <GestureHandlerRootView style={styles.zoomModalContainer}>
            <TouchableOpacity
              style={styles.zoomCloseButton}
              onPress={() => setZoomCapturedImage(null)}
            >
              <Text style={styles.zoomCloseText}>✕</Text>
            </TouchableOpacity>
            <ZoomableImage
              uri={zoomCapturedImage}
              width={screenWidth}
              height={screenHeight * 0.8}
            />
          </GestureHandlerRootView>
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
    top: 20,
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
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 25,
  },
  torchButtonText: {
    color: 'white',
    fontSize: 20,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  backButtonIcon: {
    width: 20,
    height: 20,
    tintColor: 'white',
  },
  debugToggleButton: {
    position: 'absolute',
    top: 20,
    right: 80,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    display: 'none',
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
    backgroundColor: '#C4A8FF', // Purple - all good (matches app theme)
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
    top: 20,
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
    top: 20,
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
    top: 20,
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
  // === THUMBNAIL STRIP STYLES ===
  thumbnailStripContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 50,
  },
  thumbnailScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 12,
    paddingBottom: 12,
    paddingTop: 10, // Space for badge overflow
  },
  thumbnailWrapper: {
    marginRight: 10,
    position: 'relative',
    overflow: 'visible', // Allow badge to overflow
  },
  thumbnailImage: {
    width: 60,
    height: 80,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  thumbnailBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(37, 37, 68, 1)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.6)',
  },
  thumbnailBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  thumbnailQrBadge: {
    position: 'absolute',
    bottom: -6,
    left: -6,
    backgroundColor: 'rgba(59, 130, 246, 1)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  thumbnailQrBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
  },
  continueButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  continueButton: {
    flex: 1,
    backgroundColor: 'rgba(37, 37, 68, 1)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  // === GALLERY MODAL STYLES ===
  galleryModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 1000,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  galleryHeaderDeleteButton: {
    padding: 8,
  },
  galleryHeaderDeleteIcon: {
    width: 22,
    height: 22,
    tintColor: '#9853A6',
  },
  galleryTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  galleryCloseButton: {
    padding: 8,
  },
  galleryCloseText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '300',
  },
  galleryScrollView: {
    flex: 1,
  },
  galleryScrollContent: {
    flexGrow: 1,
  },
  galleryImageContainer: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 10,
  },
  zoomScrollView: {
    flex: 1,
    width: '100%',
  },
  zoomScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImage: {
  },
  galleryDeleteButton: {
    marginTop: 16,
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(152, 83, 166, 0.4)',
  },
  galleryDeleteIcon: {
    width: 16,
    height: 16,
    tintColor: '#9853A6',
  },
  galleryDeleteText: {
    color: '#9853A6',
    fontSize: 15,
    fontWeight: '600',
  },
  galleryPageIndicator: {
    marginTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  galleryPageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  galleryIconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
    gap: 10,
  },
  galleryIconItem: {
    opacity: 0.4,
  },
  galleryIconItemActive: {
    opacity: 1,
  },
  // === Permission Screen Styles ===
  permissionContainer: {
    flex: 1,
    backgroundColor: '#2D1B4E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  permissionLogo: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  permissionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(155, 109, 208, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionIcon: {
    width: 36,
    height: 36,
    tintColor: '#C4A8FF',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionDescription: {
    fontSize: 15,
    color: '#B8A5D6',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  permissionButton: {
    width: '100%',
    backgroundColor: '#9B6DD0',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  permissionSettingsButton: {
    paddingVertical: 12,
  },
  permissionSettingsText: {
    color: '#C4A8FF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Zoom Modal Styles
  zoomOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  zoomModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseButton: {
    position: 'absolute' as const,
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  zoomCloseText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '300' as const,
  },
  // === TUNE PANEL STYLES ===
  tuneFirstTimeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  tuneFirstTimeHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  tunePanelArea: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: '#000000',
  },
  tuneSlidersContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tuneSliderRow: {
    gap: 0,
  },
  tuneSliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tuneSliderLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  tuneLabelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tuneInfoButton: {
    color: 'rgba(196, 168, 255, 0.5)',
    fontSize: 14,
  },
  tooltipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    lineHeight: 15,
    backgroundColor: 'rgba(60, 40, 90, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  tuneSlider: {
    width: '100%',
    height: 32,
  },
  tuneSliderValue: {
    color: '#C4A8FF',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'right',
  },
  tuneButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  tuneStickyButtons: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 30,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  tuneResetButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tuneResetText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
  tuneSaveButton: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#9763ff',
  },
  tuneSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  advancedToggle: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.3)',
  },
  advancedToggleText: {
    color: 'rgba(196, 168, 255, 0.6)',
    fontSize: 13,
  },
  tuneDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 10,
  },
  advancedPanel: {
    gap: 2,
  },
  advancedRow: {
    gap: 0,
  },
  advancedLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  advancedAutoText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontStyle: 'italic',
  },
  tuneRescanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
  },
});
