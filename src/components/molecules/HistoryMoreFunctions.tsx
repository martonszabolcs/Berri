import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
} from 'react-native';

interface HistoryMoreFunctionsProps {
  visible: boolean;
  onClose: () => void;
  onSelectMode: () => void;
  onDeleteAll: () => void;
}

const HistoryMoreFunctions: React.FC<HistoryMoreFunctionsProps> = ({
  visible,
  onClose,
  onSelectMode,
  onDeleteAll,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlayMode}>
      <TouchableOpacity
        style={styles.overlayBackground}
        onPress={onClose}
      />
      <View style={styles.overlayButtons}>
        <TouchableOpacity
          style={styles.overlayButton}
          onPress={onSelectMode}
        >
          <Image
            resizeMode="contain"
            source={require('../../assets/select.png')}
            style={styles.overlayButtonIcon}
          />
          <Text style={styles.overlayButtonText}>Select</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.overlayButton}
          onPress={onDeleteAll}
        >
          <Image
            resizeMode="contain"
            source={require('../../assets/trash.png')}
            style={styles.overlayButtonIcon}
          />
          <Text style={styles.overlayButtonText}>Delete All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Overlay Mode Styles
  overlayMode: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(37, 37, 68, 0.86)',
  },
  overlayButtons: {
    position: 'absolute',
    backgroundColor: 'rgba(37, 37, 68, 1)',
    paddingVertical: 30,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overlayButton: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 25,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  overlayButtonIcon: {
    width: 24,
    height: 24,
    marginRight: 5,
  },
  overlayButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '400',
  },
});

export default HistoryMoreFunctions;