import React, { useState } from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Button, RadioButton, Toggle, Text } from '../components';

type RootStackParamList = {
  DestinationScreen: { destinationId: string };
  ChangeDestinationScreen: { destinationId: string };
  ChangeRecipientScreen: { destinationId: string };
};

type DestinationScreenRouteProp = RouteProp<RootStackParamList, 'DestinationScreen'>;
type DestinationScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DestinationScreen = () => {
  const navigation = useNavigation<DestinationScreenNavigationProp>();
  const route = useRoute<DestinationScreenRouteProp>();
  const { destinationId } = route.params;
  
  const [fileType, setFileType] = useState('PDF');
  const [bundleScans, setBundleScans] = useState(false);

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

  const handleChangeDestination = () => {
    navigation.navigate('ChangeDestinationScreen', { destinationId });
  };

  const handleChangeRecipient = () => {
    navigation.navigate('ChangeRecipientScreen', { destinationId });
  };

  return (
    <Layout type="default" headerTitle={`Type ${destinationId}`}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Destination Info */}
        <View style={styles.destinationInfo}>
          <Image 
            source={getDestinationImage(destinationId)} 
            style={styles.destinationImage}
          />
          <View style={styles.emailContainer}>
            <Text style={styles.emailLabel}>Email</Text>
            <Text style={styles.emailText}>test@email.com</Text>
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
    paddingBottom: 100, // Extra space for tab bar
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default DestinationScreen;