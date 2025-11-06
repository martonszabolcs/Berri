import React from 'react';
import { useState } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle,
  TouchableOpacityProps 
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'normal' | 'outline' | 'destructive' | 'text';
  size?: 'small' | 'medium' | 'large';
  textStyle?: TextStyle;
  buttonStyle?: ViewStyle;
}

const Button = ({
  title,
  variant = 'normal',
  size = 'medium',
  onPress,
  disabled = false,
  textStyle,
  buttonStyle,
  ...props
}: ButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);

  const getButtonStyles = (): ViewStyle[] => {
    const baseStyle: ViewStyle[] = [styles.button, styles[size]];
    
    if (variant === 'outline') {
      baseStyle.push(styles.outlineButton);
    } else if (variant === 'destructive') {
      baseStyle.push(styles.destructiveButton);
    } else if (variant === 'text') {
      baseStyle.push(styles.textButton);
    } else {
      baseStyle.push(styles.normalButton);
    }

    if (disabled) {
      baseStyle.push(styles.disabled);
    }

    if (isPressed) {
      baseStyle.push(styles.pressed);
    }

    if (buttonStyle) {
      baseStyle.push(buttonStyle);
    }

    return baseStyle;
  };

  const getTextStyles = (): TextStyle[] => {
    const baseStyle: TextStyle[] = [styles.text, styles[`${size}Text` as keyof typeof styles] as TextStyle];
    
    if (variant === 'outline') {
      baseStyle.push(styles.outlineText);
    } else if (variant === 'destructive') {
      baseStyle.push(styles.destructiveText);
    } else if (variant === 'text') {
      baseStyle.push(styles.textText);
    } else {
      baseStyle.push(styles.normalText);
    }

    if (disabled) {
      baseStyle.push(styles.disabledText);
    }

    if (textStyle) {
      baseStyle.push(textStyle);
    }

    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={getButtonStyles()}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      activeOpacity={0.8}
      {...props}
    >
      <Text style={getTextStyles()}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  
  // Variants
  normalButton: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderColor: 'white',
  },
  destructiveButton: {
    backgroundColor: '#ff4444',
    borderColor: 'white',
  },
  textButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  
  // Sizes
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 44,
  },
  large: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    minHeight: 52,
  },
  
  // Text styles
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  
  // Text variants
  normalText: {
    color: 'black',
  },
  outlineText: {
    color: 'white',
  },
  destructiveText: {
    color: 'white',
  },
  textText: {
    color: '#ff4444',
    fontWeight: '400',
  },
  
  // States
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});

export default Button;