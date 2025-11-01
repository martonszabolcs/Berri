import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { 
  Dest1Icon, 
  Dest2Icon, 
  Dest3Icon, 
  Dest4Icon, 
  Dest5Icon, 
  Dest6Icon, 
  Dest7Icon 
} from '../icons';

type DestinationType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type VariantType = 'screen' | 'screen-selected' | 'history' | 'history-active';

interface DestinationIconProps {
  type: DestinationType;
  variant: VariantType;
  size?: number;
}

const DestinationIcon: React.FC<DestinationIconProps> = ({ 
  type, 
  variant, 
  size 
}) => {
  // Default sizes based on variant
  const getSize = () => {
    if (size) return size;
    switch (variant) {
      case 'screen':
      case 'screen-selected':
        return 55;
      case 'history':
      case 'history-active':
        return 32; // Increased from 40 to 60
      default:
        return 32;
    }
  };

  const iconSize = getSize();

  // Get colors based on variant
  const getColors = () => {
    switch (variant) {
      case 'screen':
        return {
          iconColor: '#FFFFFF',
          backgroundColor: null,
          backgroundType: 'gradient-white-light-purple'
        };
      case 'screen-selected':
        return {
          iconColor: '#FFFFFF',
          backgroundColor: null,
          backgroundType: 'gradient-light-blue-dark-blue'
        };
      case 'history':
        return {
          iconColor: '#9853A6',
          backgroundColor: null,
          backgroundType: 'gradient-white-purple-solid'
        };
      case 'history-active':
        return {
          iconColor: '#9853A6',
          backgroundColor: null,
          backgroundType: 'gradient-white-purple'
        };
      default:
        return {
          iconColor: '#000000',
          backgroundColor: '#FFFFFF',
          backgroundType: 'solid'
        };
    }
  };

  const colors = getColors();

  const renderBackground = () => {
    // Background circle should always be centered in the 103x103 viewBox
    const bgCenter = 51.5; // Center of 103x103 viewBox
    const bgRadius = 45; // Appropriate radius for the background circle
    
    if (colors.backgroundType === 'solid' && colors.backgroundColor) {
      return (
        <Circle
          cx={bgCenter}
          cy={bgCenter}
          r={bgRadius}
          fill={colors.backgroundColor}
        />
      );
    }

    if (colors.backgroundType === 'gradient-blue-purple') {
      return (
        <>
          <Defs>
            <RadialGradient
              id="blueToPurple"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="0%" stopColor="#E8D5FF" stopOpacity="1" />
              <Stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={bgCenter}
            cy={bgCenter}
            r={bgRadius}
            fill="url(#blueToPurple)"
          />
        </>
      );
    }

    if (colors.backgroundType === 'gradient-white-purple') {
      return (
        <>
          <Defs>
            <RadialGradient
              id="whiteToPurple"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={bgCenter}
            cy={bgCenter}
            r={bgRadius}
            fill="url(#whiteToPurple)"
          />
        </>
      );
    }

    if (colors.backgroundType === 'gradient-white-light-purple') {
      return (
        <>
          <Defs>
            <RadialGradient
              id="whiteToLightPurple"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 0.5)" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="rgba(255, 230, 255, 0.5)" stopOpacity="0.5" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={bgCenter}
            cy={bgCenter}
            r={bgRadius}
            fill="url(#whiteToLightPurple)"
          />
        </>
      );
    }

    if (colors.backgroundType === 'gradient-white-purple-solid') {
      return (
        <>
          <Defs>
            <RadialGradient
              id="whiteToPurpleSolid"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFE6FF" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={bgCenter}
            cy={bgCenter}
            r={bgRadius}
            fill="url(#whiteToPurpleSolid)"
          />
        </>
      );
    }

    if (colors.backgroundType === 'gradient-light-blue-dark-blue') {
      return (
        <>
          <Defs>
            <RadialGradient
              id="lightBlueToDarkBlue"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="0%" stopColor="rgba(189, 228, 255, 0.5)" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="rgba(0, 123, 209, 0.5)" stopOpacity="0.5" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={bgCenter}
            cy={bgCenter}
            r={bgRadius}
            fill="url(#lightBlueToDarkBlue)"
          />
        </>
      );
    }

    return null;
  };

  const renderIcon = () => {
    switch (type) {
      case 1:
        return <Dest1Icon color={colors.iconColor} width={iconSize} height={iconSize} />;
      case 2:
        return <Dest2Icon color={colors.iconColor} width={iconSize} height={iconSize} />;
      case 3:
        return <Dest3Icon color={colors.iconColor} width={iconSize} height={iconSize} />;
      case 4:
        return <Dest4Icon color={colors.iconColor} width={iconSize} height={iconSize} />;
      case 5:
        return <Dest5Icon color={colors.iconColor} width={iconSize} height={iconSize} />;
      case 6:
        return <Dest6Icon color={colors.iconColor} width={iconSize} height={iconSize} />;
      case 7:
        return <Dest7Icon color={colors.iconColor} width={iconSize} height={iconSize} />;
      default:
        // Placeholder for other icons
        return (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 103 103">
            <Circle cx="51.5" cy="51.5" r="20" fill={colors.iconColor} />
          </Svg>
        );
    }
  };

  return (
    <View style={[styles.container, { width: iconSize, height: iconSize }]}>
      <Svg width={iconSize} height={iconSize} viewBox="0 0 103 103">
        {renderBackground()}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.container]}>
        {renderIcon()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DestinationIcon;