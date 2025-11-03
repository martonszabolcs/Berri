import React, { useState } from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Button, RadioButton, Toggle, Text } from '../components';
import { useAppSelector } from '../store/hooks';

type RootStackParamList = {
  DestinationScreen: { destination: any };
  ChangeDestinationScreen: { destination: any };
  ChangeRecipientScreen: { destination: any };
};

type DestinationScreenRouteProp = RouteProp<RootStackParamList, 'DestinationScreen'>;
type DestinationScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const DestinationScreen = () => {
  const navigation = useNavigation<DestinationScreenNavigationProp>();
  const route = useRoute<DestinationScreenRouteProp>();
  const { destination } = route.params;
  const destinationId = destination.type.toString();
    const user = useAppSelector((state) => state.app.user);
  
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
    navigation.navigate('ChangeDestinationScreen', { destination });
  };

  const handleChangeRecipient = () => {
    navigation.navigate('ChangeRecipientScreen', { destination });
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
    <Layout type="dark" headerTitle={`${getFruitName(destination.type.toString())}`}>
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