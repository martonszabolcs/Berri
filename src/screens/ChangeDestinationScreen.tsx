import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Layout, Button, Text } from '../components';

type RootStackParamList = {
  ChangeDestinationScreen: { destination: any };
};

type ChangeDestinationScreenRouteProp = RouteProp<RootStackParamList, 'ChangeDestinationScreen'>;

type DestinationType = 'Google Drive' | 'Dropbox' | 'OneDrive' | 'Email';

const ChangeDestinationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ChangeDestinationScreenRouteProp>();
  const { destination } = route.params;
  const destinationId = destination.type.toString();
  
  const [selectedDestination, setSelectedDestination] = useState<DestinationType>('Email');

  const getDestinationName = (dest: any) => {
    if (dest.destination && dest.destination !== 'email') {
      return dest.destination.charAt(0).toUpperCase() + dest.destination.slice(1);
    }
    return getFruitName(dest.type.toString());
  };

  const getFruitName = (type: string) => {
    switch (type) {
      case '1': return 'Cherry';
      case '2': return 'Ananas'; 
      case '3': return 'Apple';
      case '4': return 'Banana';
      case '5': return 'Orange';
      case '6': return 'Melone';
      case '7': return 'Grapes';
      default: return 'Unknown Fruit';
    }
  };

  // Set initial selected destination based on current destination
  React.useEffect(() => {
    if (destination.destination) {
      switch (destination.destination.toLowerCase()) {
        case 'dropbox':
          setSelectedDestination('Dropbox');
          break;
        case 'google_drive':
        case 'googledrive':
          setSelectedDestination('Google Drive');
          break;
        case 'onedrive':
          setSelectedDestination('OneDrive');
          break;
        default:
          setSelectedDestination('Email');
      }
    }
  }, [destination.destination]);

  // Get destination image based on type
  const getDestinationImage = (type: string) => {
    switch (type) {
      case '1': return require('../assets/dest_1.png');
      case '2': return require('../assets/dest_2.png');
      case '3': return require('../assets/dest_3.png');
      case '4': return require('../assets/dest_4.png');
      case '5': return require('../assets/dest_5.png');
      case '6': return require('../assets/dest_6.png');
      case '7': return require('../assets/dest_7.png');
      default: return require('../assets/dest_1.png');
    }
  };

  const destinations: DestinationType[] = ['Google Drive', 'Dropbox', 'OneDrive', 'Email'];

  const handleDestinationSelect = (destinationType: DestinationType) => {
    setSelectedDestination(destinationType);
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <Layout type="dark" headerTitle={`Change ${getDestinationName(destination)} Destination`}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Current Destination Info */}
        <View style={styles.destinationInfo}>
          <Image 
            source={getDestinationImage(destinationId)} 
            style={styles.destinationImage}
          />
          <View style={styles.emailContainer}>
            <Text style={styles.emailLabel}>Current Email</Text>
            <Text style={styles.emailText}>{destination.emails || 'No email set'}</Text>
          </View>
        </View>

        {/* Destination Options */}
        <View style={styles.optionsContainer}>
          {destinations.map((destinationType) => (
            <TouchableOpacity
              key={destinationType}
              style={[
                styles.destinationOption,
                selectedDestination === destinationType && styles.destinationOptionActive
              ]}
              onPress={() => handleDestinationSelect(destinationType)}
            >
              <Text style={[
                styles.destinationOptionText,
                selectedDestination === destinationType && styles.destinationOptionTextActive
              ]}>
                {destinationType}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cancel Button */}
        <View style={styles.buttonContainer}>
          <Button
            title="Cancel"
            variant="outline"
            size="large"
            onPress={handleCancel}
          />
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
  destinationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    paddingVertical: 20,
  },
  destinationImage: {
    width: 60,
    height: 60,
    marginRight: 20,
  },
  emailContainer: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emailText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  optionsContainer: {
    gap: 15,
    marginBottom: 40,
  },
  destinationOption: {
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  destinationOptionActive: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  destinationOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  destinationOptionTextActive: {
    color: 'black',
  },
  buttonContainer: {
    paddingBottom: 100, // Extra space for tab bar
  },
});

export default ChangeDestinationScreen;