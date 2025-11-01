import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Text, DestinationIcon } from '../components';

type RootStackParamList = {
  DestinationScreen: { destinationId: string };
};

type DestinationsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DestinationsScreen = () => {
  const navigation = useNavigation<DestinationsScreenNavigationProp>();

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const navigateToDestination = (destinationId: string) => {
    navigation.navigate('DestinationScreen', { destinationId });
  };

  return (
    <Layout type="default">
      <ScrollView>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
            <Image source={require('../assets/menu.png')} style={styles.menuIcon} />
          </TouchableOpacity>
          <Text style={styles.title}>Destinations</Text>
        </View>
        
        <View style={styles.content}>
          {[1, 2, 3, 4, 5, 6, 7].map((id) => (
            <TouchableOpacity 
              key={id}
              style={styles.destinationCard} 
              onPress={() => navigateToDestination(id.toString())}
            >
              <View style={styles.cardContent}>
                <DestinationIcon type={id as 1 | 2 | 3 | 4 | 5 | 6 | 7} variant="history-active" />
                <Text style={styles.destinationText}>Destination {id}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  menuButton: {
    marginRight: 20,
  },
  menuIcon: {
    width: 24,
    height: 24,
    tintColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  destinationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  destinationText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DestinationsScreen;