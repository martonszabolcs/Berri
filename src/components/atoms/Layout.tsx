import React from 'react';
import { ReactNode } from 'react';
import { 
  View, 
  StyleSheet, 
  ImageBackground, 
  ViewStyle,
  StatusBar
} from 'react-native';
import BackgroundOverlay from './BackgroundOverlay';
import Header from './Header';

// Import the background images
const bgPurple = require('../../assets/bg_purple.png');
const bgPurpleAuth = require('../../assets/bg_purple_auth.png');

interface LayoutProps {
  children: ReactNode;
  type?: 'auth' | 'default' | 'dark';
  color?: 'purple' | 'blue';
  style?: ViewStyle;
  headerTitle?: string;
  showLogout?: boolean;
  showBackButton?: boolean;
  onLogout?: () => void;
  onMenuPress?: () => void;
  rightComponent?: ReactNode;
}

const Layout = ({ 
  children, 
  type = 'default', 
  color = 'purple',
  style,
  headerTitle,
  showLogout = false,
  showBackButton = true,
  onLogout,
  onMenuPress,
  rightComponent
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

  // For dark type, we still use the background image but overlay it
  const isDarkType = type === 'dark';

  // Suppress unused variable warning for color (will be used for future blue variant)
  console.debug('Color prop:', color);

  return (
    <ImageBackground 
      source={getBackgroundImage()} 
      style={[styles.container, style]}
      resizeMode="cover"
    >
      <StatusBar  barStyle={'dark-content'} />
      {isDarkType && <BackgroundOverlay />}
      
      <View style={styles.content}>
        {headerTitle && (
          <Header 
            title={headerTitle} 
            showBackButton={showBackButton}
            showLogout={showLogout}
            onLogout={onLogout}
            onMenuPress={onMenuPress}
            rightComponent={rightComponent}
            isDark={isDarkType}
          />
        )}
        <View style={styles.childrenContainer}>
          {children}
        </View>
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
  childrenContainer: {
    flex: 1,
  },
});

export default Layout;