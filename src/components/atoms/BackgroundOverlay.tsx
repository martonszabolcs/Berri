import React from 'react';
import { View, StyleSheet } from 'react-native';

const BackgroundOverlay = () => {
  return <View style={styles.overlay} />;
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#252544',
    zIndex: -1, // Behind content but above background image
  },
});

export default BackgroundOverlay;