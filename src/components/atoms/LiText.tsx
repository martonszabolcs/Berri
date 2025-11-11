import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../';

interface LiTextProps {
  text: string;
}

const LiText = ({ text }: LiTextProps) => {
  return (
    <View style={styles.liContainer}>
      <View style={styles.bullet} />
      <Text>{text}</Text>
    </View>
  );
};

export default LiText;

const styles = StyleSheet.create({
  liContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  bullet: {
    marginRight: 8,
    width: 10,
    height: 10,
    borderRadius: 20,
    backgroundColor: 'white',
  },
});
