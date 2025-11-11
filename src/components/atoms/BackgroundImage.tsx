import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';
const bgPurpleAuth = require('../../assets/bg_purple_auth.png');

const BackgroundImage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ImageBackground
      source={bgPurpleAuth}
      style={styles.background}
    >
      {children}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover',
  },
});

export default BackgroundImage;