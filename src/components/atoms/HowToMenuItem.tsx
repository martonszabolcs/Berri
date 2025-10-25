import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Image, View } from 'react-native';

interface HowToMenuItemProps {
  title: string;
  imageUrl: string;
  onPress: () => void;
}

const HowToMenuItem = ({ title, imageUrl, onPress }: HowToMenuItemProps) => {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Image source={{ uri: imageUrl }} style={styles.menuImage} />
      <Text style={styles.menuTitle}>{title}</Text>
      <View style={styles.arrowContainer}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
    borderRadius: 45, // Teljesen lekerekített (magasság kb. 90px, így 45px radius)
  },
  menuImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  arrowText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default HowToMenuItem;