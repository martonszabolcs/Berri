import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Button, RadioButton, Toggle, Text } from '../components';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { updateDestinationSettings } from '../store/api/userApiService';
import { refreshUser } from '../store/appSlice';

type RootStackParamList = {
  DestinationScreen: { destination: any };
  ChangeDestinationScreen: { destination: any };
  ChangeRecipientScreen: { destination: any };
};

type DestinationScreenRouteProp = RouteProp<
  RootStackParamList,
  'DestinationScreen'
>;
type DestinationScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DestinationScreen = () => {
  const navigation = useNavigation<DestinationScreenNavigationProp>();
  const route = useRoute<DestinationScreenRouteProp>();
  const dispatch = useAppDispatch();
  const destinationId = route.params.destination.type.toString();
  const user = useAppSelector(state => state.app.user);
  const destinations = useAppSelector(state => state.app.destinations);
  const [destination, setDestination] = useState(route.params.destination);

  useEffect(() => {
    setDestination(
      destinations.find(dest => dest.type.toString() === destinationId) ||
        destination,
    );
  }, [destinations, destinationId, destination]);

  const [fileType, setFileType] = useState('PDF');
  const [bundleScans, setBundleScans] = useState(false);

  // Get destination image based on type
  const getDestinationImage = (type: string) => {
    switch (type) {
      case '1':
        return require('../assets/dest_1.png');
      case '2':
        return require('../assets/dest_2.png');
      case '3':
        return require('../assets/dest_3.png');
      case '4':
        return require('../assets/dest_4.png');
      case '5':
        return require('../assets/dest_5.png');
      case '6':
        return require('../assets/dest_6.png');
      case '7':
        return require('../assets/dest_7.png');
      default:
        return require('../assets/dest_1.png');
    }
  };

  const handleChangeDestination = () => {
    navigation.navigate('ChangeDestinationScreen', { destination });
  };

  const handleChangeRecipient = () => {
    navigation.navigate('ChangeRecipientScreen', { destination });
  };

  const handleSaveSettings = async () => {
    try {
      console.log('🚀 Saving destination settings:', { fileType, bundleScans });
      const success = await updateDestinationSettings(destinationId, {
        fileType: fileType.toLowerCase() === 'pdf' ? 'pdf' : 'jpg',
        bundled: bundleScans,
      });

      if (success) {
        console.log('✅ Destination settings saved successfully');

        // Refresh user data to get updated destinations
        await dispatch(refreshUser());
        console.log('✅ User data refreshed after destination settings save');
      } else {
        console.error('❌ Failed to save destination settings');
      }
    } catch (error) {
      console.error('❌ Error saving destination settings:', error);
    }
  };
  const getFruitName = (type: string) => {
    switch (type) {
      case '1':
        return 'Cherry';
      case '2':
        return 'Ananas';
      case '3':
        return 'Apple';
      case '4':
        return 'Banana';
      case '5':
        return 'Orange';
      case '6':
        return 'Melone';
      case '7':
        return 'Grapes';
      default:
        return 'Unknown Fruit';
    }
  };
  return (
    <Layout
      type="dark"
      headerTitle={`${getFruitName(destination.type.toString())}`}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Destination Info */}
        <View style={styles.destinationInfo}>
          <Image
            source={getDestinationImage(destinationId)}
            style={styles.destinationImage}
          />
          <View style={styles.emailContainer}>
            <Text style={styles.emailLabel}>Email</Text>
            <Text style={styles.emailText}>{user.email}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <Button
            title="Change Recipient"
            variant="outline"
            size="medium"
            buttonStyle={styles.actionButton}
            onPress={handleChangeRecipient}
          />
          <Button
            title="Change Destination"
            variant="outline"
            size="medium"
            buttonStyle={styles.actionButton}
            onPress={handleChangeDestination}
          />
        </View>

        {/* Destination Settings */}
        <View style={styles.settingsContainer}>
          <Text style={styles.settingsTitle}>Destination Settings</Text>

          <RadioButton
            label="File Type"
            options={['PDF', 'JPEG']}
            selectedValue={fileType}
            onValueChange={setFileType}
          />

          <Toggle
            label="Bundle Scans"
            value={bundleScans}
            onValueChange={setBundleScans}
          />

          <View style={styles.saveButtonContainer}>
            <Button
              title="Save Settings"
              size="medium"
              onPress={handleSaveSettings}
            />
          </View>
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
    marginBottom: 30,
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
  buttonsContainer: {
    gap: 15,
    marginBottom: 30,
  },
  actionButton: {
    width: '100%',
  },
  settingsContainer: {
    // Removed paddingBottom since it's now in saveButtonContainer
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  saveButtonContainer: {
    marginTop: 30,
    paddingBottom: 100, // Extra space for tab bar
  },
});

export default DestinationScreen;
