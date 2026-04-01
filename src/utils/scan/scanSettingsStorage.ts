import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ScanQualityLevels,
  DEFAULT_QUALITY_LEVELS,
  applyScanQualityPreset,
  AdvancedScanSettings,
  DEFAULT_ADVANCED_SETTINGS,
  applyAdvancedOverrides,
} from './scanConfig';

const STORAGE_KEY = '@berri_scan_quality_settings';
const ADVANCED_STORAGE_KEY = '@berri_scan_advanced_settings';

export const saveScanQualitySettings = async (
  levels: ScanQualityLevels,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
    applyScanQualityPreset(levels);
    // Re-apply advanced overrides on top
    const adv = await loadAdvancedSettings();
    applyAdvancedOverrides(adv);
  } catch (e) {
    console.warn('Failed to save scan quality settings:', e);
  }
};

export const loadScanQualitySettings = async (): Promise<{
  levels: ScanQualityLevels;
  isFirstTime: boolean;
}> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const levels: ScanQualityLevels = JSON.parse(raw);
      applyScanQualityPreset(levels);
      // Re-apply advanced overrides on top
      const adv = await loadAdvancedSettings();
      applyAdvancedOverrides(adv);
      return { levels, isFirstTime: false };
    }
  } catch (e) {
    console.warn('Failed to load scan quality settings:', e);
  }
  return { levels: { ...DEFAULT_QUALITY_LEVELS }, isFirstTime: true };
};

export const saveAdvancedSettings = async (
  adv: AdvancedScanSettings,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(ADVANCED_STORAGE_KEY, JSON.stringify(adv));
    applyAdvancedOverrides(adv);
  } catch (e) {
    console.warn('Failed to save advanced scan settings:', e);
  }
};

export const loadAdvancedSettings = async (): Promise<AdvancedScanSettings> => {
  try {
    const raw = await AsyncStorage.getItem(ADVANCED_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_ADVANCED_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load advanced scan settings:', e);
  }
  return { ...DEFAULT_ADVANCED_SETTINGS };
};

export const clearAdvancedSettings = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ADVANCED_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear advanced scan settings:', e);
  }
};
