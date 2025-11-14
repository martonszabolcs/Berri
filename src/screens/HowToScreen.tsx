import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Layout, HowToMenuItem } from '../components';
import ht1 from '../assets/HT1.png';
import ht2 from '../assets/HT2.png';
import ht3 from '../assets/HT3.png';
import ht4 from '../assets/HT4.png';
import ht5 from '../assets/HT5.png';

interface HowToItem {
  title: string;
  imageUrl: string;
  url: string;
}

const HOW_TO_ITEMS: HowToItem[] = [
  {
    title: 'SET UP DESTINATIONS',
    imageUrl: ht1,
    url: 'https://www.google.com',
  },
  {
    title: 'SCAN YOUR BERRĪBOOK',
    imageUrl: ht2,
    url: 'https://www.google.com',
  },
  {
    title: 'ERASE YOUR BERRĪBOOK',
    imageUrl: ht3,
    url: 'https://www.google.com',
  },
  {
    title: 'USE YOUR FRIXION PEN',
    imageUrl: ht4,
    url: 'https://www.google.com',
  },
  {
    title: 'BERRĪNEWS',
    imageUrl: ht5,
    url: 'https://www.google.com',
  },
];

const HowToScreen = () => {
  const handleItemPress = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <Layout type="dark" headerTitle="How to / news" showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {HOW_TO_ITEMS.map((item, index) => (
            <HowToMenuItem
              key={index}
              title={item.title}
              imageUrl={item.imageUrl}
              onPress={() => handleItemPress(item.url)}
            />
          ))}
        </View>
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingTop: 20,
  },
});

export default HowToScreen;