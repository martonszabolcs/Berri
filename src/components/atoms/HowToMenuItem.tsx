import React from 'react';
import { TouchableOpacity, StyleSheet, Image, View } from 'react-native';
import Svg, { Rect, LinearGradient, Stop, Defs } from 'react-native-svg';
import Text from './Text';

interface HowToMenuItemProps {
  title: string;
  imageUrl: string;
  onPress: () => void;
}

const HowToMenuItem = ({ title, imageUrl, onPress }: HowToMenuItemProps) => {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      {/* Gradient Background */}
      <View style={styles.gradientBackground}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient
              id="menuGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 0.2)" />
              <Stop offset="100%" stopColor="rgba(255, 231, 255, 0.2)" />
            </LinearGradient>
          </Defs>
          
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#menuGradient)"
          />
        </Svg>
      </View>
      
      {/* Content */}
      <Image source={imageUrl} style={styles.menuImage} />
      <Text style={styles.menuTitle}>{title}</Text>
      <View style={styles.arrowContainer}>
        <Image 
          source={require('../../assets/left_arrow.png')} 
          style={styles.arrowImage}
          resizeMode='contain'
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderRadius: 99,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 99,
    overflow: 'hidden',
    opacity: 0.5
  },
  menuImage: {
    width: 60,
    height: 60,
    borderRadius: 60,
    marginRight: 16,
    zIndex: 1,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    zIndex: 1,
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    zIndex: 1,
  },
  arrowImage: {
    width: 20,
    height: 20,
    transform: [{ scaleX: -1 }], // Tükrözés jobbra
    tintColor: 'white',
  },
});

export default HowToMenuItem;