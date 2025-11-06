import React from 'react';
import { TouchableOpacity, StyleSheet, View, Image } from 'react-native';
import Text from './Text';

interface MenuListItemProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
}

const MenuListItem = ({ title, subtitle, onPress }: MenuListItemProps) => {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.textContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && (
          <Text style={styles.menuSubtitle}>{subtitle}</Text>
        )}
      </View>
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
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  menuSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowImage: {
    width: 16,
    height: 16,
    transform: [{ scaleX: -1 }], // Tükrözés jobbra
    tintColor: 'white',
  },
});

export default MenuListItem;