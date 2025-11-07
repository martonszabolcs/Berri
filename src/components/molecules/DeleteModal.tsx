import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';

interface DeleteModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  message?: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  message = 'Are you sure you want to delete all history items?',
}) => {
  if (!visible) return null;

  return (
    <View style={styles.confirmationOverlay}>
      <TouchableOpacity
        style={styles.overlayBackground}
        onPress={onCancel}
      />
      <View style={styles.confirmationDialog}>
        <Text style={styles.confirmationText}>
          {message}
        </Text>
        <View style={styles.confirmationButtons}>
          <TouchableOpacity
            style={[styles.confirmationButton, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>No</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmationButton, styles.deleteButton]}
            onPress={onConfirm}
          >
            <Text style={styles.deleteButtonText}>Yes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Confirmation Dialog Styles
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(37, 37, 68, 0.86)',
  },
  confirmationDialog: {
    backgroundColor: '#252544',
    margin: 40,
    borderRadius: 15,
    padding: 25,
    borderWidth: 1,
    borderColor: 'white',
  },
  confirmationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
    color: 'white',
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  confirmationButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    minWidth: 80,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default DeleteModal;