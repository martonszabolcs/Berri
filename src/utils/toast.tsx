import React from 'react';
import { StyleSheet } from 'react-native';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

// Berri color palette
const COLORS = {
  primary: '#6B3FA0', // Main Berri purple
  primaryDark: '#4A2C7A',
  primaryLight: '#9B6DD0',
  success: '#4CAF50',
  successDark: '#2E7D32',
  error: '#E53935',
  errorDark: '#B71C1C',
  warning: '#FF9800',
  warningDark: '#E65100',
  info: '#6B3FA0',
  text: '#FFFFFF',
  textSecondary: '#E0D4F0',
  background: '#1E0F36',
};

// Custom toast configurations with Berri styling
export const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={[styles.baseToast, styles.successToast]}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={[styles.baseToast, styles.errorToast]}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={[styles.baseToast, styles.infoToast]}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
  warning: (props) => (
    <BaseToast
      {...props}
      style={[styles.baseToast, styles.warningToast]}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
};

const styles = StyleSheet.create({
  baseToast: {
    borderLeftWidth: 0,
    borderRadius: 12,
    height: 'auto',
    minHeight: 60,
    paddingVertical: 12,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successToast: {
    backgroundColor: COLORS.primaryDark,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
  },
  errorToast: {
    backgroundColor: COLORS.errorDark,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.error,
  },
  infoToast: {
    backgroundColor: COLORS.primaryDark,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
  },
  warningToast: {
    backgroundColor: COLORS.warningDark,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.warning,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  text1: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  text2: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});

// Helper functions for showing toasts
export const showSuccessToast = (title: string, message?: string) => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
    visibilityTime: 3000,
    position: 'top',
    topOffset: 60,
  });
};

export const showErrorToast = (title: string, message?: string) => {
  Toast.show({
    type: 'error',
    text1: title,
    text2: message,
    visibilityTime: 4000,
    position: 'top',
    topOffset: 60,
  });
};

export const showInfoToast = (title: string, message?: string) => {
  Toast.show({
    type: 'info',
    text1: title,
    text2: message,
    visibilityTime: 3000,
    position: 'top',
    topOffset: 60,
  });
};

export const showWarningToast = (title: string, message?: string) => {
  Toast.show({
    type: 'warning',
    text1: title,
    text2: message,
    visibilityTime: 3500,
    position: 'top',
    topOffset: 60,
  });
};

export default Toast;
