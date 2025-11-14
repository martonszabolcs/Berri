import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Text from './Text';
import { useRef, useEffect } from 'react';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
}

const Toggle = ({ value, onValueChange, label }: ToggleProps) => {
  const translateX = useRef(new Animated.Value(value ? 49 : 3)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? 49 : 3,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [value, translateX]);

  const handleToggle = () => {
    onValueChange(!value);
  };

  const renderToggleButton = () => {
    if (value) {
      // ON state - purple gradient
      return (
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Defs>
            <RadialGradient
              id="purpleGradient"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="2.88%" stopColor="rgba(152, 83, 166, 0.77)" stopOpacity="1" />
              <Stop offset="92.31%" stopColor="#9853A6" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle
            cx="14"
            cy="14"
            r="14"
            fill="url(#purpleGradient)"
          />
        </Svg>
      );
    } else {
      // OFF state - white to gray gradient
      return (
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Defs>
            <RadialGradient
              id="grayGradient"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="100%" stopColor="#999999" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle
            cx="14"
            cy="14"
            r="14"
            fill="url(#grayGradient)"
          />
        </Svg>
      );
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      {/* Toggle Track */}
      <TouchableOpacity
        style={[
          styles.toggle, 
          value && styles.toggleActive
        ]}
        onPress={handleToggle}
        activeOpacity={0.8}
      >
        {/* ON Text - Left side */}
        <Text style={[
          styles.toggleText, 
          styles.onText,
          value && styles.activeText
        ]}>
          ON
        </Text>
        
        {/* Toggle Button */}
        <Animated.View
          style={[
            styles.toggleButtonContainer,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {renderToggleButton()}
        </Animated.View>
        
        {/* OFF Text - Right side */}
        <Text style={[
          styles.toggleText, 
          styles.offText,
          !value && styles.activeText
        ]}>
          OFF
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  toggle: {
    width: 80,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
    position: 'relative',
    flexDirection: 'row',
  },
  toggleActive: {
    backgroundColor: '#FFE7FF80',
  },
  toggleButtonContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    position: 'absolute',
    left: 3,
    zIndex: 2,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    position: 'absolute',
    zIndex: 1,
  },
  onText: {
    left: 8,
  },
  offText: {
    right: 6,
  },
  activeText: {
    color: 'white',
  },
});

export default Toggle;