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
  },
  bullet: {
    marginRight: 8,
    width: 6,
    height: 6,
    borderRadius: 20,
    marginTop: 2,
    backgroundColor: 'white',
  },
});
