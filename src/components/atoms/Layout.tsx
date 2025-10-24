import React from 'react';
import { ReactNode } from 'react';
import { 
  View, 
  StyleSheet, 
  ImageBackground, 
  ViewStyle 
} from 'react-native';

// Import the background images
const bgPurple = require('../../assets/bg_purple.png');
const bgPurpleAuth = require('../../assets/bg_purple_auth.png');

interface LayoutProps {
  children: ReactNode;
  type?: 'auth' | 'default';
  color?: 'purple' | 'blue';
  style?: ViewStyle;
}

const Layout = ({ 
  children, 
  type = 'default', 
  color = 'purple',
  style 
}: LayoutProps) => {
  // Determine which background image to use
  const getBackgroundImage = () => {
    // For now, using purple images for both purple and blue
    // Blue images can be added later when available
    if (type === 'auth') {
      return bgPurpleAuth;
    }
    return bgPurple;
  };

  return (
    <ImageBackground 
      source={getBackgroundImage()} 
      style={[styles.container, style]}
      resizeMode="cover"
    >
      <View style={styles.content}>
        {children}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default Layout;