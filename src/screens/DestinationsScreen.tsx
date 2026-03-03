import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Text, DestinationIcon } from '../components';
import { useAppSelector } from '../store/hooks';

type RootStackParamList = {
  DestinationScreen: { destination: any };
};

type DestinationsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DestinationsScreen = () => {
  const navigation = useNavigation<DestinationsScreenNavigationProp>();
  const destinations = useAppSelector((state) => state.app.destinations);
  const user = useAppSelector((state) => state.app.user);
  const [allDestinations, setAllDestinations] = useState<any[]>([]);

  useEffect(() => {
    const all = [1,2,3,4,5,6,7];
    const allDest = all.map((type) => {
      const savedDest = destinations.find((dest) => dest.type === type);
      return savedDest ? {...savedDest, saved: true} : { type, destination: "email", emails: user.email, saved: false };
    });
    setAllDestinations(allDest);
  }, [destinations, user.email]);

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const navigateToDestination = (destination: any) => {
    navigation.navigate('DestinationScreen', { destination });
  };

  return (
    <Layout 
      type="dark"
      headerTitle='Destinations'
      onMenuPress={openDrawer}
    >
      <ScrollView>
        <View style={styles.content}>
          
          {allDestinations.map((destination: any) => (
            <TouchableOpacity 
              key={destination.type}
              style={[
                styles.destinationCard,
                // destination.saved ? styles.savedCard : styles.unsavedCard
              ]} 
              onPress={() => navigateToDestination(destination)}
            >
              <View style={styles.cardContent}>
                <DestinationIcon type={destination.type} variant="screen" />
                <View style={styles.destinationInfo}>
                  <Text style={styles.destinationText}>{destination.destination === "email" ? "E-mail" : destination.destination}</Text>
                  <Text style={styles.destinationText}>{destination.emails || user.email}</Text>
                </View>
                <Image 
                  resizeMode='contain'
                  source={require('../assets/left_arrow.png')} 
                  style={styles.arrowIcon} 
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  destinationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 10,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  arrowIcon: {
    width: 20,
    height: 20,
    tintColor: 'white',
    transform: [{ rotate: '180deg' }],
    marginRight: 20
  },
  destinationInfo: {
    flex: 1,
  },
  destinationText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },
});

export default DestinationsScreen;