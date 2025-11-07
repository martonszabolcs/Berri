import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Button } from '..';

interface DeleteModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.confirmationOverlay}>
      <TouchableOpacity style={styles.overlayBackground} onPress={onCancel} />
      <View style={styles.confirmationDialog}>
        <Text style={styles.confirmationText}>Are you sure you want to delete all scans?</Text>
        <View style={styles.confirmationButtons}>
          <Button onPress={onConfirm} title="YES" />
          <Button variant="outline" onPress={onCancel} title="NO" />
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
    margin: 40,
    marginTop: 150,
    borderRadius: 15,
    padding: 25,
  },
  confirmationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
    color: 'white',
  },
  confirmationButtons: {
    flexDirection: 'column',
    gap: 20,
  }
});

export default DeleteModal;
