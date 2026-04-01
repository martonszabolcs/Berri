import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../components';
import { scanDocument } from '../utils/scan/scanDocument';
import { applyScanQualityPreset, DEFAULT_QUALITY_LEVELS } from '../utils/scan/scanConfig';
import { loadScanQualitySettings, saveScanQualitySettings } from '../utils/scan/scanSettingsStorage';
import Slider from '@react-native-community/slider';
import RNFS from 'react-native-fs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 40;

// Dummy corners that span most of the image - scanDocument re-detects anyway
const makeDummyCorners = (w: number, h: number) => {
  const margin = 0.05;
  return [
    { x: w * margin, y: h * margin },
    { x: w * (1 - margin), y: h * margin },
    { x: w * (1 - margin), y: h * (1 - margin) },
    { x: w * margin, y: h * (1 - margin) },
  ];
};

const TEST_IMAGE_NAME = 'test_scan.jpg';

const ScanTestScreen = () => {
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [stepImages, setStepImages] = useState<{ label: string; image: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [tuneBlackLevel, setTuneBlackLevel] = useState(DEFAULT_QUALITY_LEVELS.blackLevel);
  const [tuneColorLevel, setTuneColorLevel] = useState(DEFAULT_QUALITY_LEVELS.colorLevel);
  const [isRescanning, setIsRescanning] = useState(false);
  const lastBase64Ref = useRef<string>('');
  const tuneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved settings on mount
  useEffect(() => {
    loadScanQualitySettings().then(result => {
      if (result.existed) {
        setTuneBlackLevel(result.settings.blackLevel);
        setTuneColorLevel(result.settings.colorLevel);
      }
    });
  }, []);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResultImage(null);
    setStepImages([]);
    setInfo(null);

    try {
      // Try multiple locations for the test image
      const possiblePaths = [
        `${RNFS.DocumentDirectoryPath}/${TEST_IMAGE_NAME}`,
        `${RNFS.CachesDirectoryPath}/${TEST_IMAGE_NAME}`,
        `${RNFS.MainBundlePath}/${TEST_IMAGE_NAME}`,
        `${RNFS.MainBundlePath}/Group 6.jpg`,
      ];

      let base64 = '';
      let usedPath = '';

      for (const p of possiblePaths) {
        try {
          const exists = await RNFS.exists(p);
          if (exists) {
            base64 = await RNFS.readFile(p, 'base64');
            usedPath = p;
            break;
          }
        } catch (_) {
          // Try next path
        }
      }

      if (!base64) {
        setError(
          `Image not found!\n\n` +
          `Copy the test image to the app Documents dir:\n\n` +
          `iOS Simulator:\n` +
          `xcrun simctl get_app_container booted com.berri data\n` +
          `# then cp Group 6.jpg <container>/Documents/${TEST_IMAGE_NAME}\n\n` +
          `Tried:\n${possiblePaths.join('\n')}`
        );
        setLoading(false);
        return;
      }

      setInfo(`Loaded from: ${usedPath}\nBase64 length: ${base64.length}`);
      lastBase64Ref.current = base64;

      // Apply current tune levels
      applyScanQualityPreset({ blackLevel: tuneBlackLevel, colorLevel: tuneColorLevel });

      // iPhone fotó raw pixelekben landscape (4032x3024), EXIF forgatja portrait-re
      const estimatedWidth = 4032;
      const estimatedHeight = 3024;

      const dummyCorners = makeDummyCorners(estimatedWidth, estimatedHeight);

      console.log('🧪 Starting scan test...');

      const result = scanDocument({
        rawImageBase64: base64,
        frameCorners: dummyCorners,
        processedCorners: dummyCorners,
        currentQrValue: null,
        currentQrPosition: null,
        qrBounds: null,
        photoWidth: estimatedWidth,
        photoHeight: estimatedHeight,
        frameWidth: estimatedWidth,
        frameHeight: estimatedHeight,
        frameBrightness: 128,
        enableDebugImages: true,
      });

      console.log('🧪 Scan result:', {
        success: result.success,
        error: result.error,
        hasImage: !!result.imageBase64,
        stepCount: result.stepImages?.length ?? 0,
        brightness: result.brightnessInfo,
      });

      if (result.success && result.imageBase64) {
        setResultImage(result.imageBase64);
      } else {
        setError(result.error || 'Scan failed - no output');
      }

      if (result.stepImages && result.stepImages.length > 0) {
        setStepImages(result.stepImages);
      }

      setInfo(prev =>
        (prev || '') +
        `\n\nResult: ${result.success ? 'SUCCESS' : 'FAIL'}` +
        `\nBrightness: ${result.brightnessInfo?.avgBrightness ?? 'N/A'}` +
        `\nLight: ${result.brightnessInfo?.lightCondition ?? 'N/A'}` +
        `\nSteps: ${result.stepImages?.length ?? 0}` +
        `\nIcons: ${result.selectedIconNames?.join(', ') ?? 'none'}` +
        `\nIcon analysis: ${result.iconAnalysis?.map((ic: any) => `${ic.icon}: ${ic.darkPercent}%${ic.active ? ' ✓' : ''}`).join(' | ') ?? 'N/A'}`
      );
    } catch (e: any) {
      console.error('🧪 Scan test error:', e);
      setError(`Error: ${e.message}\n\n${e.stack}`);
    } finally {
      setLoading(false);
    }
  }, [tuneBlackLevel, tuneColorLevel]);

  // Re-scan with new tune values (debounced)
  const handleTuneRescan = useCallback(async (blackLevel: number, colorLevel: number) => {
    if (!lastBase64Ref.current) { return; }
    setIsRescanning(true);
    try {
      applyScanQualityPreset({ blackLevel, colorLevel });
      const estimatedWidth = 4032;
      const estimatedHeight = 3024;
      const dummyCorners = makeDummyCorners(estimatedWidth, estimatedHeight);
      const result = scanDocument({
        rawImageBase64: lastBase64Ref.current,
        frameCorners: dummyCorners,
        processedCorners: dummyCorners,
        currentQrValue: null,
        currentQrPosition: null,
        qrBounds: null,
        photoWidth: estimatedWidth,
        photoHeight: estimatedHeight,
        frameWidth: estimatedWidth,
        frameHeight: estimatedHeight,
        frameBrightness: 128,
        enableDebugImages: true,
      });
      if (result.success && result.imageBase64) {
        setResultImage(result.imageBase64);
      }
      if (result.stepImages && result.stepImages.length > 0) {
        setStepImages(result.stepImages);
      }
    } catch (e) {
      console.warn('Tune re-scan failed:', e);
    } finally {
      setIsRescanning(false);
    }
  }, []);

  const handleTuneSliderChange = (blackLevel: number, colorLevel: number) => {
    if (tuneDebounceRef.current) {
      clearTimeout(tuneDebounceRef.current);
    }
    tuneDebounceRef.current = setTimeout(() => {
      handleTuneRescan(blackLevel, colorLevel);
    }, 400);
  };

  const handleTuneSave = () => {
    saveScanQualitySettings({ blackLevel: tuneBlackLevel, colorLevel: tuneColorLevel });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Scan Pipeline Test</Text>
        <Text style={styles.subtitle}>Group 6.jpg</Text>

        {/* Tune panel */}
        <View style={styles.tuneContainer}>
          <Text style={styles.tuneTitle}>Scan quality settings</Text>
          {isRescanning && (
            <ActivityIndicator size="small" color="#C4A8FF" style={styles.tuneSpinner} />
          )}
          <View style={styles.tuneSliderRow}>
            <Text style={styles.tuneLabel}>Black ink</Text>
            <View style={styles.tuneSliderTrack}>
              <Text style={styles.tuneEndLabel}>Weak</Text>
              <Slider
                style={styles.tuneSlider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={tuneBlackLevel}
                onValueChange={(val: number) => {
                  setTuneBlackLevel(val);
                  handleTuneSliderChange(val, tuneColorLevel);
                }}
                minimumTrackTintColor="#C4A8FF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#FFFFFF"
              />
              <Text style={styles.tuneEndLabel}>Strong</Text>
            </View>
            <Text style={styles.tuneValue}>{tuneBlackLevel}</Text>
          </View>
          <View style={styles.tuneSliderRow}>
            <Text style={styles.tuneLabel}>Color ink</Text>
            <View style={styles.tuneSliderTrack}>
              <Text style={styles.tuneEndLabel}>Weak</Text>
              <Slider
                style={styles.tuneSlider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={tuneColorLevel}
                onValueChange={(val: number) => {
                  setTuneColorLevel(val);
                  handleTuneSliderChange(tuneBlackLevel, val);
                }}
                minimumTrackTintColor="#C4A8FF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#FFFFFF"
              />
              <Text style={styles.tuneEndLabel}>Strong</Text>
            </View>
            <Text style={styles.tuneValue}>{tuneColorLevel}</Text>
          </View>
          <View style={styles.tuneButtonsRow}>
            <TouchableOpacity
              style={styles.tuneResetButton}
              onPress={() => {
                setTuneBlackLevel(DEFAULT_QUALITY_LEVELS.blackLevel);
                setTuneColorLevel(DEFAULT_QUALITY_LEVELS.colorLevel);
                handleTuneSliderChange(DEFAULT_QUALITY_LEVELS.blackLevel, DEFAULT_QUALITY_LEVELS.colorLevel);
              }}
            >
              <Text style={styles.tuneResetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tuneSaveButton}
              onPress={handleTuneSave}
            >
              <Text style={styles.tuneSaveText}>Save settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={runScan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Run Scan</Text>
          )}
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}

        {/* Final result */}
        {resultImage && (
          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Final Result</Text>
            <Image
              source={{ uri: `data:image/png;base64,${resultImage}` }}
              style={[styles.image, { height: IMAGE_WIDTH * 1.667 }]}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Step images */}
        {stepImages.map((step, index) => (
          <View key={index} style={styles.imageSection}>
            <Text style={styles.sectionTitle}>{step.label}</Text>
            <Image
              source={{ uri: `data:image/png;base64,${step.image}` }}
              style={[styles.image, { height: IMAGE_WIDTH * 1.667 }]}
              resizeMode="contain"
            />
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scroll: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6c63ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  error: {
    color: '#ff6b6b',
    fontSize: 12,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  info: {
    color: '#aaa',
    fontSize: 11,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  imageSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  image: {
    width: IMAGE_WIDTH,
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
  },
  tuneContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tuneTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tuneSpinner: {
    marginBottom: 8,
  },
  tuneSliderRow: {
    marginBottom: 12,
  },
  tuneLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  tuneSliderTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tuneEndLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    width: 40,
    textAlign: 'center',
  },
  tuneSlider: {
    flex: 1,
    height: 40,
  },
  tuneValue: {
    color: '#C4A8FF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  tuneButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  tuneResetButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tuneResetText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  tuneSaveButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#6c63ff',
  },
  tuneSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ScanTestScreen;
