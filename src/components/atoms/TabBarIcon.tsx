import React from 'react';
import { Image, ImageSourcePropType } from 'react-native';

interface TabBarIconProps {
  source: ImageSourcePropType;
  size: number;
  color: string;
}

export const TabBarIcon: React.FC<TabBarIconProps> = ({ source, size, color }) => (
  <Image
    resizeMode="contain"
    source={source}
    style={{ width: size, height: size, tintColor: color }}
  />
);

export default TabBarIcon;