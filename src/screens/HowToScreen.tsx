import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Layout, Header, HowToMenuItem } from '../components';

interface HowToItem {
  title: string;
  imageUrl: string;
  url: string;
}

const HOW_TO_ITEMS: HowToItem[] = [
  {
    title: 'SET UP DESTINATIONS',
    imageUrl: 'https://picsum.photos/100/100?random=1',
    url: 'https://www.google.com',
  },
  {
    title: 'SCAN YOUR BERRĪBOOK',
    imageUrl: 'https://picsum.photos/100/100?random=2',
    url: 'https://www.google.com',
  },
  {
    title: 'ERASE YOUR BERRĪBOOK',
    imageUrl: 'https://picsum.photos/100/100?random=3',
    url: 'https://www.google.com',
  },
  {
    title: 'USE YOUR FRIXION PEN',
    imageUrl: 'https://picsum.photos/100/100?random=4',
    url: 'https://www.google.com',
  },
  {
    title: 'BERRĪNEWS',
    imageUrl: 'https://picsum.photos/100/100?random=5',
    url: 'https://www.google.com',
  },
];

const HowToScreen = () => {
  const handleItemPress = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <Layout type="dark">
      <Header title="How to / news" showBackButton />
      
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
    paddingBottom: 100, // Extra space for tab bar
  },
});

export default HowToScreen;