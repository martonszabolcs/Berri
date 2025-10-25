import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Text from './Text';
import { useState, useRef, useEffect } from 'react';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
}

const Toggle = ({ value, onValueChange, label }: ToggleProps) => {
  const translateX = useRef(new Animated.Value(value ? 22 : 2)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? 22 : 2,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [value, translateX]);

  const handleToggle = () => {
    onValueChange(!value);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.toggle, value && styles.toggleActive]}
        onPress={handleToggle}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.toggleButton,
            {
              transform: [{ translateX }],
            },
          ]}
        />
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
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: 'white',
  },
  toggleButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default Toggle;