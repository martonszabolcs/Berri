import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Text, DestinationIcon } from '../components';
import { useAppSelector, useAppDispatch } from '../store/hooks';

type RootStackParamList = {
  DestinationScreen: { destinationId: string };
};

type DestinationsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DestinationsScreen = () => {
  const navigation = useNavigation<DestinationsScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const destinations = useAppSelector((state) => state.app.destinations);

  useEffect(() => {
    // Fetch destinations when component mounts
  }, [dispatch]);

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
          {/* Display destinations as JSON */}
          <View style={styles.jsonContainer}>
            <Text style={styles.jsonTitle}>Destinations Data:</Text>
            <Text style={styles.jsonText}>{JSON.stringify(destinations, null, 2)}</Text>
          </View>
          
          {destinations.map((destination) => (
            <TouchableOpacity 
              key={destination.type}
              style={[
                styles.destinationCard,
                destination.saved ? styles.savedCard : styles.unsavedCard
              ]} 
              onPress={() => navigateToDestination(destination.type.toString())}
            >
              <View style={styles.cardContent}>
                <DestinationIcon type={destination.type} variant="screen" />
                <View style={styles.destinationInfo}>
                  <Text style={styles.destinationText}>Destination {destination.type}</Text>
                  <Text style={[
                    styles.statusText,
                    destination.saved ? styles.savedText : styles.unsavedText
                  ]}>
                    {destination.saved ? 'Saved' : 'Not Saved'}
                  </Text>
                </View>
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
  jsonContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  jsonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  jsonText: {
    fontSize: 12,
    color: 'white',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  destinationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
  },
  savedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50', // Green for saved
  },
  unsavedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800', // Orange for unsaved
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  statusText: {
    fontSize: 12,
    marginTop: 4,
  },
  savedText: {
    color: '#4CAF50',
  },
  unsavedText: {
    color: '#FF9800',
  },
});

export default DestinationsScreen;