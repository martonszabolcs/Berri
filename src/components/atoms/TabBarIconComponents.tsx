import React from 'react';
import { TabBarIcon } from './TabBarIcon';
import history from '../../assets/history.png'
import newScan from '../../assets/new_scan.png';
import destinations from '../../assets/destinations.png';

interface TabBarIconComponentProps {
  color: string;
  size: number;
}

export const HistoryTabBarIcon: React.FC<TabBarIconComponentProps> = ({ color, size }) => (
  <TabBarIcon
    source={history}
    size={size}
    color={color}
  />
);

export const NewScanTabBarIcon: React.FC<TabBarIconComponentProps> = ({ color, size }) => (
  <TabBarIcon
    source={newScan}
    size={size}
    color={color}
  />
);

export const DestinationsTabBarIcon: React.FC<TabBarIconComponentProps> = ({ color, size }) => (
  <TabBarIcon
    source={destinations}
    size={size}
    color={color}
  />
);