import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

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
        <Text style={styles.arrowText}>›</Text>
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
    marginBottom: 1,
    borderRadius: 8,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  menuTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  arrowText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default MenuListItem;