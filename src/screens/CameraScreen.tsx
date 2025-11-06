import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useInferenceLogic, DetectionResult } from '../utils/scan/useInferenceLogic';
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
  ActivityIndicator,
  Share,
} from 'react-native';
import { Dirs, FileSystem } from 'react-native-file-access';
import { saveScannedDocument } from '../utils/saveImage';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppSelector } from '../store/hooks';

// Navigation types
type RootStackParamList = {
  DestinationSelectScreen: { 
    savedFilePath: string
    destinationType?: number
  };
};

type CameraScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DestinationSelectScreen'
>;

interface DocumentCorner {
  x: number;
  y: number;
}

// === UI SZÖVEGEK - KÖZPONTI KONFIGURÁCIÓ ===
// Minden felhasználónak megjelenő szöveget itt definiálunk egy helyen
// Ez megkönnyíti a későbbi szövegmódosításokat és fordítást
const UI_MESSAGES = {
  // Keresés / Nincs detektálás
  SEARCHING: 'Keresd a BERRĪ keretét',
  SEARCHING_INSTRUCTION:
    'Tedd a füzetet jól látható helyre, jó megvilágításban',

  // Részben látható (alacsony confidence)
  PARTIALLY_VISIBLE: (confidence: number) =>
    `BERRĪ részben látható (${Math.round(confidence * 100)}%)`,
  PARTIALLY_INSTRUCTION: 'Próbáld beállítani a szöget',

  // Keresés folyamatban
  SEARCHING_PROGRESS: (confidence: number) =>
    `Keresés... (${Math.round(confidence * 100)}%)`,
  SEARCHING_PROGRESS_INSTRUCTION: 'Mozgasd a kamerát a BERRĪ fölé',

  // Menj közelebb
  MOVE_CLOSER: (confidence: number) =>
    `Menj közelebb (${Math.round(confidence * 100)}%)`,
  MOVE_CLOSER_INSTRUCTION: 'Menj közelebb a BERRĪ-hez',

  // Észlelve
  DETECTED: (confidence: number) =>
    `BERRĪ észlelve! (${Math.round(confidence * 100)}%)`,
  DETECTED_INSTRUCTION: 'Tartsd stabilan',

  // Figyelmeztetés - téglalap alakja rossz
  RECTANGLE_WARNING: ' ⚠️ Tartsd szemben a füzettel!',

  // QR kód detektálva
  QR_DETECTED: ' ✓ QR kód beolvasva',

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
  const DEBUG_ON = true; // false = nincs debug kép, jobb teljesítmény!

  // Navigation
  const navigation = useNavigation<CameraScreenNavigationProp>();

  const settings = useAppSelector(state => state.app.settings);
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null); // Camera ref for tap-to-focus
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [smoothedResults, setSmoothedResults] = useState<DetectionResult[]>([]);
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

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

  const [_calibrationInfo, setCalibrationInfo] = useState<
    DetectionResult['calibrationInfo'] | null
  >(null);

  // Photo & torch states
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [showCapturedImage, setShowCapturedImage] = useState(false);
  
  // Auto capture states
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [photosQueue, setPhotosQueue] = useState<Array<{
    base64: string;
    confidence: number;
    sharpness?: number;
    timestamp: number;
  }>>([]);
  const optimalConditionsStartRef = useRef<number | null>(null);
  const autoCaptureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

      if (result.qrInfo?.includes('QR:✓')) {
        qrConsecutiveDetectionsRef.current++;
        qrConsecutiveNoDetectionsRef.current = 0;

        if (qrConsecutiveDetectionsRef.current >= QR_STABLE_THRESHOLD.detect) {
          setCurrentQrInfo(result.qrInfo);
          setCurrentQrPosition(result.qrPosition || null);
          qrDetectedTimestampRef.current = Date.now();
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
        }
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

          setSmoothedResults([
            {
              ...last,
              corners: smoothedCorners,
              processedCorners: smoothedProcessedCorners,
              confidence: smoothedConfidence,
              frameWidth: last.frameWidth,
              frameHeight: last.frameHeight,
              qrBounds: last.qrBounds, // QR bounds átmásolása
              qrPosition: last.qrPosition, // QR pozíció átmásolása
            },
          ]);
        } else {
          setSmoothedResults(newResults);
        }
      } else {
        detectionHistoryRef.current = [];
        setSmoothedResults([]);
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
  // Handles document photo capture and processing
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
      setIsCapturing(true);

      // MENTJÜK EL a jelenlegi corner adatokat MIELŐTT leállítanánk a frame processort!
      const captureCorners =
        smoothedResults[0].processedCorners || smoothedResults[0].corners;
      const captureQrPosition = smoothedResults[0].qrPosition;
      const captureQrBounds = smoothedResults[0].qrBounds;
      const captureFrameWidth = smoothedResults[0].frameWidth;
      const captureFrameHeight = smoothedResults[0].frameHeight;

      // 🔴 STOP: Állítsuk le a frame processor-t fotózás alatt!
      console.log('⏸️ Pausing frame processor for photo capture');
      setIsFrameProcessorActive(false);

      // Várjunk egy kicsit hogy az utolsó frame processor befejezze a clearBuffers()-t

      const photo = await camera.current.takePhoto({
        enableShutterSound: true,
      });

      const photoBase64 = await FileSystem.readFile(photo.path, 'base64');

      // Fotó méretének lekérdezése Image.getSize-zal
      const photoSize = await new Promise<{ width: number; height: number }>(
        (resolve, _reject) => {
          Image.getSize(
            `data:image/jpeg;base64,${photoBase64}`,
            (width, height) => resolve({ width, height }),
            error => {
              console.warn('Failed to get image size:', error);
              resolve({ width: 0, height: 0 }); // Fallback
            },
          );
        },
      );

      const result = await scanDocument({
        rawImageBase64: photoBase64,
        corners: captureCorners,
        currentQrPosition: captureQrPosition,
        qrBounds: captureQrBounds, // QR kód pontos bounds
        photoWidth: photoSize.width,
        photoHeight: photoSize.height,
        frameWidth: captureFrameWidth,
        frameHeight: captureFrameHeight,
      });

      if (result.success && result.imageBase64) {
        setCapturedImageUri(result.imageBase64);
        setDebugCorners(result.debugCorners || null);
        setSelectedIcons(result.selectedIcons || []);
        setSelectedIconNames(result.selectedIconNames || []);
        setBrightnessInfo(result.brightnessInfo || null);
        setShowCapturedImage(true);
      }
    } catch (error) {
      // Silent fail - user can retry
      console.error('Photo capture error:', error);
    } finally {
      setIsCapturing(false);

      // 🟢 START: Indítsuk újra a frame processor-t!
      console.log('▶️ Resuming frame processor');
      setIsFrameProcessorActive(true);
    }
  }, [smoothedResults]);

  // === AUTO CAPTURE FUNCTIONALITY ===
  // Selects the best photo from the captured sequence
  const selectBestPhoto = useCallback((photos: Array<{
    base64: string;
    confidence: number;
    sharpness?: number;
    timestamp: number;
  }>) => {
    if (photos.length === 0) return null;
    
    // Score photos based on confidence (primary) and timing (secondary)
    const scoredPhotos = photos.map((photo, index) => ({
      ...photo,
      score: photo.confidence * 100 + (index === 1 ? 5 : 0), // Slightly prefer middle photo
    }));

    // Sort by score descending and return the best one
    scoredPhotos.sort((a, b) => b.score - a.score);
    return scoredPhotos[0];
  }, []);

  // Processes the automatically captured best photo
  const processAutoCapture = useCallback(async (photoBase64: string) => {
    if (smoothedResults.length === 0 || smoothedResults[0].corners.length !== 4) {
      return;
    }

    // Save current detection data
    const captureCorners = smoothedResults[0].processedCorners || smoothedResults[0].corners;
    const captureQrPosition = smoothedResults[0].qrPosition;
    const captureQrBounds = smoothedResults[0].qrBounds;
    const captureFrameWidth = smoothedResults[0].frameWidth;
    const captureFrameHeight = smoothedResults[0].frameHeight;

    // Get photo dimensions
    const photoSize = await new Promise<{ width: number; height: number }>(
      (resolve, _reject) => {
        Image.getSize(
          `data:image/jpeg;base64,${photoBase64}`,
          (width, height) => resolve({ width, height }),
          error => {
            console.warn('Failed to get image size:', error);
            resolve({ width: 0, height: 0 });
          },
        );
      },
    );

    const result = await scanDocument({
      rawImageBase64: photoBase64,
      corners: captureCorners,
      currentQrPosition: captureQrPosition,
      qrBounds: captureQrBounds,
      photoWidth: photoSize.width,
      photoHeight: photoSize.height,
      frameWidth: captureFrameWidth,
      frameHeight: captureFrameHeight,
    });

    if (result.success && result.imageBase64) {
      setCapturedImageUri(result.imageBase64);
      setDebugCorners(result.debugCorners || null);
      setSelectedIcons(result.selectedIcons || []);
      setSelectedIconNames(result.selectedIconNames || []);
      setBrightnessInfo(result.brightnessInfo || null);
      setShowCapturedImage(true);
    }
  }, [smoothedResults]);

  // Starts automatic capture sequence - takes 3 photos and selects the best one
  const startAutoCapture = useCallback(async () => {
    if (!camera.current || autoCapturing) return;

    try {
      setAutoCapturing(true);
      setPhotosQueue([]);
      
      // Pause frame processor during capture
      setIsFrameProcessorActive(false);
      
      // Take 3 photos with minimal delays for speed
      const photoPromises: Promise<{
        base64: string;
        confidence: number;
        timestamp: number;
      }>[] = [];

      for (let i = 0; i < 3; i++) {
        if (i > 0) {
          await new Promise<void>(resolve => setTimeout(() => resolve(), 50)); // Ultra fast: only 50ms between photos
        }
        
        // Start photo capture and file reading in parallel
        const photoPromise = (async () => {
          const photo = await camera.current!.takePhoto({
            enableShutterSound: false, // Silent for auto capture
          });

          const photoBase64 = await FileSystem.readFile(photo.path, 'base64');
          
          // Get current detection data for this photo
          const currentConfidence = smoothedResults.length > 0 ? smoothedResults[0].confidence : 0;
          
          return {
            base64: photoBase64,
            confidence: currentConfidence,
            timestamp: Date.now(),
          };
        })();

        photoPromises.push(photoPromise);
      }

      // Wait for all photos to be processed
      const allCapturedPhotos = await Promise.all(photoPromises);

      // Select the best photo based on confidence and other factors
      const bestPhoto = selectBestPhoto(allCapturedPhotos);
      
      if (bestPhoto) {
        await processAutoCapture(bestPhoto.base64);
      }

    } catch (error) {
      console.error('Auto capture error:', error);
    } finally {
      setAutoCapturing(false);
      setIsFrameProcessorActive(true);
      setPhotosQueue([]);
    }
  }, [smoothedResults, autoCapturing, selectBestPhoto, processAutoCapture]);

  // === SHARE FUNCTIONALITY ===
  // Handles sharing the captured image
  const handleShare = useCallback(async () => {
    if (!capturedImageUri) return;

    try {
      // Save the base64 image to a temporary file for sharing
      const tempPath = `${Dirs.CacheDir}/captured_document.jpg`;

      await FileSystem.writeFile(tempPath, capturedImageUri, 'base64');

      await Share.share({
        url: `file://${tempPath}`,
        message: 'Beszkennelt BERRĪ füzet',
      });

      // Save to permanent storage with unique filename
      const savedPath = await saveScannedDocument(capturedImageUri, settings);
      
      if (savedPath) {
        console.log('✅ Document saved permanently:', savedPath);
        
        // Navigate to DestinationSelectScreen with the saved file path
        navigation.navigate('DestinationSelectScreen', { 
          savedFilePath: savedPath,
          destinationType: 1,
        });
        
      } else {
        console.warn('⚠️ Failed to save document permanently');
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [capturedImageUri, navigation]);  // === TAP TO FOCUS ===
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

  // === AUTO CAPTURE LOGIC ===
  // Checks if conditions are optimal for automatic photo capture
  const isOptimalForCapture = useCallback(() => {
    if (smoothedResults.length === 0 || smoothedResults[0].corners.length !== 4) {
      return false;
    }

    const result = smoothedResults[0];
    const hasQrCode = currentQrInfo?.includes('QR:✓');
    const { isGood: isRectangleGood } = checkRectangleShape(result.corners);
    const goodConfidence = result.confidence >= 0.8;

    return hasQrCode && isRectangleGood && goodConfidence && !autoCapturing && !showCapturedImage;
  }, [smoothedResults, currentQrInfo, checkRectangleShape, autoCapturing, showCapturedImage]);

  // Automatically capture photos when optimal conditions are met
  useEffect(() => {
    const optimal = isOptimalForCapture();
    
    if (optimal) {
      if (optimalConditionsStartRef.current === null) {
        optimalConditionsStartRef.current = Date.now();
      } else {
        const timeInOptimal = Date.now() - optimalConditionsStartRef.current;
        
        // Start auto capture after 0.5 seconds of stable optimal conditions (much faster)
        if (timeInOptimal >= 500 && !autoCapturing && autoCaptureTimeoutRef.current === null) {
          // Immediate start - no countdown
          startAutoCapture();
        }
      }
    } else {
      // Reset if conditions are no longer optimal
      optimalConditionsStartRef.current = null;
      if (autoCaptureTimeoutRef.current) {
        clearTimeout(autoCaptureTimeoutRef.current);
        autoCaptureTimeoutRef.current = null;
      }
      // No countdown to reset - removed for speed
    }
  }, [isOptimalForCapture, autoCapturing, startAutoCapture]);

  // === STATUS CALCULATION ===
  // Determines current UI state based on detection confidence and shape
  const getCurrentStatus = () => {
    if (results.length === 0) {
      return {
        isDetected: false,
        isRectangleGood: true,
        message: UI_MESSAGES.SEARCHING,
        instruction: UI_MESSAGES.SEARCHING_INSTRUCTION,
      };
    }

    const latestResult = results[0];
    let confidence =
      smoothedResults.length > 0
        ? smoothedResults[0].confidence
        : latestResult.confidence;
    const hasQrCode = currentQrInfo?.includes('QR:✓');
    const qrMessage = hasQrCode ? UI_MESSAGES.QR_DETECTED : '';

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
      if (confidence < 0.7) {
        return {
          isDetected: false,
          isRectangleGood,
          message: UI_MESSAGES.MOVE_CLOSER(confidence),
          instruction:
            UI_MESSAGES.MOVE_CLOSER_INSTRUCTION + rectangleWarning + qrMessage,
        };
      }

      // High confidence - detected
      const baseMessage = UI_MESSAGES.DETECTED(confidence);
      const autoMessage = autoCapturing 
          ? ' (Fotózás folyamatban...)'
          : '';
      
      return {
        isDetected: true,
        isRectangleGood,
        message: baseMessage + autoMessage,
        instruction:
          UI_MESSAGES.DETECTED_INSTRUCTION + rectangleWarning + qrMessage,
      };
    }

    // Fallback - no valid corners
    if (confidence > 0.5) {
      return {
        isDetected: true,
        isRectangleGood: true,
        message: UI_MESSAGES.DETECTED(confidence),
        instruction: UI_MESSAGES.DETECTED_INSTRUCTION + qrMessage,
      };
    } else if (confidence > 0.2) {
      return {
        isDetected: false,
        isRectangleGood: true,
        message: UI_MESSAGES.PARTIALLY_VISIBLE(confidence),
        instruction: UI_MESSAGES.PARTIALLY_INSTRUCTION,
      };
    }

    return {
      isDetected: false,
      isRectangleGood: true,
      message: UI_MESSAGES.SEARCHING_PROGRESS(confidence),
      instruction: UI_MESSAGES.SEARCHING_PROGRESS_INSTRUCTION,
    };
  };

  const currentStatus = getCurrentStatus();

  // === OVERLAY RENDERING ===
  // Renders document corners overlay on camera feed
  const renderDocumentOverlay = () => {
    if (smoothedResults.length === 0 || smoothedResults[0].corners.length !== 4)
      return null;

    const { corners, confidence } = smoothedResults[0];
    const { isGood: isRectangleGood } = checkRectangleShape(corners);
    const hasQrCode = currentQrInfo?.includes('QR:✓');

    // Build path from corners
    const path = Skia.Path.Make();
    path.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach(c => path.lineTo(c.x, c.y));
    path.close();

    // Determine overlay color and style
    const COLORS = { GREEN: '#B2FBA5', YELLOW: '#FFF52E', RED: '#FF746C' };

    let pathColor: string;
    let pathStyle: 'fill' | 'stroke' = 'stroke';
    let strokeWidth = 2;

    if (!isRectangleGood) {
      pathColor = COLORS.RED;
    } else if (confidence >= 0.7) {
      pathColor = hasQrCode ? `${COLORS.GREEN}80` : COLORS.GREEN;
      pathStyle = hasQrCode ? 'fill' : 'stroke';
      strokeWidth = hasQrCode ? 0 : 2;
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
                photo={true}
                enableFpsGraph={true}
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

          {/* Debug Image Switch - CSAK HA DEBUG_ON === true */}
          {DEBUG_ON && (
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
          )}

          {/* Torch (világítás) gomb */}
          <TouchableOpacity
            style={[styles.torchButton]}
            onPress={() => setTorchEnabled(!torchEnabled)}
          >
            <Text style={styles.torchButtonText}>
              {torchEnabled ? '🔦 BE' : '🔦 KI'}
            </Text>
          </TouchableOpacity>

          {/* Document overlay - OPTIMALIZÁLÁS: Csak akkor rendereljük ha van mit mutatni */}
          {smoothedResults.length > 0 &&
            smoothedResults[0].corners.length === 4 && (
              <Canvas
                style={[
                  styles.overlay,
                  {
                    width: cameraViewSize.width,
                    height: cameraViewSize.height,
                  },
                ]}
              >
                {renderDocumentOverlay()}
              </Canvas>
            )}

          {/* UI Controls */}
          <View style={styles.controlsContainer}>
            {/* Status indicator with detailed message */}
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusIndicator,
                  (smoothedResults.length > 0 &&
                    smoothedResults[0].confidence < 0.6) ||
                  (results.length > 0 && results[0].confidence < 0.6)
                    ? styles.statusNotDetected
                    : (smoothedResults.length > 0 &&
                        smoothedResults[0].confidence < 0.7) ||
                      (results.length > 0 && results[0].confidence < 0.7)
                    ? styles.statusWarning
                    : currentStatus.isDetected
                    ? styles.statusDetected
                    : styles.statusNotDetected,
                ]}
              />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusText}>{currentStatus.message}</Text>
                <Text style={styles.instructionText}>
                  {currentStatus.instruction}
                </Text>
              </View>
            </View>

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

          {/* Manual Capture Button - csak ha nincs auto capture és van detektált dokumentum */}
          {smoothedResults.length > 0 &&
            smoothedResults[0].corners.length === 4 &&
            smoothedResults[0].confidence >= 0.7 &&
            currentStatus.isRectangleGood &&
            !showCapturedImage &&
            !autoCapturing && ( // Disable manual capture during auto capture (no countdown check needed)
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  showDebugImage && styles.captureButtonDebugMode,
                ]}
                onPress={handleCapture}
                disabled={isCapturing} // Disable during capture
              >
                <Text style={styles.captureButtonText}>
                  {UI_MESSAGES.BUTTON_CAPTURE}
                </Text>
              </TouchableOpacity>
            )}

          {/* Auto Capturing Indicator */}
          {autoCapturing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#B2FBA5" />
              <Text style={styles.loadingText}>Gyors 3 fotó készítése...</Text>
            </View>
          )}

          {/* Loading Indicator - Manual photo capture közben */}
          {isCapturing && !autoCapturing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#B2FBA5" />
              <Text style={styles.loadingText}>Fotó készítése...</Text>
            </View>
          )}
        </>
      )}

      {/* Captured Image Modal */}
      {showCapturedImage && capturedImageUri && (
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${capturedImageUri}` }}
              style={styles.capturedImageStyle}
              resizeMode="contain"
            />

            <View style={styles.detectedInfoContainer}>
              {selectedIconNames.length > 0 && (
                <View style={styles.detectedIconsSection}>
                  <Text style={styles.detectedIconsTitle}>Ikonok:</Text>
                  <Text style={styles.detectedIconsText}>
                    {selectedIconNames
                      .map((name, idx) => ({
                        name,
                        segment: selectedIcons[idx],
                      }))
                      .filter(item => item.segment !== 0) // 0. szegmens kihagyása
                      .map(item => `${item.segment}:${item.name}`)
                      .join(', ')}
                  </Text>
                </View>
              )}

              {brightnessInfo && (
                <View style={styles.brightnessInfoSection}>
                  <Text style={styles.brightnessInfoText}>
                    Fényerő: {brightnessInfo.avgBrightness} (
                    {brightnessInfo.lightCondition}) • Boost: +
                    {brightnessInfo.betaBoost}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Share button */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>
              {UI_MESSAGES.BUTTON_SHARE}
            </Text>
          </TouchableOpacity>

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => {
              setShowCapturedImage(false);
              setCapturedImageUri(null);
              setDebugCorners(null);
              setSelectedIcons([]);
              setSelectedIconNames([]);
              setBrightnessInfo(null);
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
    backgroundColor: 'white',
    zIndex: 1000,
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
    position: 'absolute',
    zIndex: -1,
    bottom: 20,
    marginHorizontal: 20,
    marginTop: 10,
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
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
});
