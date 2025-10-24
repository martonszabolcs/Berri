import React from 'react';
import { useState } from 'react';
import { TextInput as RNTextInput, StyleSheet, View, TextInputProps } from 'react-native';

interface CustomTextInputProps extends TextInputProps {
  placeholder?: string;
}

const TextInput = ({ 
  placeholder, 
  value, 
  onChangeText,
  style,
  ...props 
}: CustomTextInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      <RNTextInput
        style={styles.textInput}
        placeholder={placeholder}
        placeholderTextColor="rgba(255, 255, 255, 0.7)"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      <View style={[styles.underline, isFocused && styles.underlineFocused]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  textInput: {
    color: 'white',
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  underline: {
    height: 1,
    backgroundColor: 'white',
    marginTop: 4,
  },
  underlineFocused: {
    backgroundColor: 'white',
    height: 2,
  },
});

export default TextInput;
