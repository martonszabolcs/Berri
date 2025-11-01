import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Layout, Button, RadioButton, Toggle, Text, CloudStorageConnector } from '../components';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { refreshConnectionStatus } from '../store/settingsSlice';

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
  const dispatch = useAppDispatch();
  const { connectionStatus } = useAppSelector((state) => state.settings);
  
  const [fileType, setFileType] = useState('PDF');
  const [bundleScans, setBundleScans] = useState(false);
  const [selectedStorage, setSelectedStorage] = useState<'googleDrive' | 'oneDrive' | 'dropbox' | null>(null);

  // Map destination types to storage types
  const getStorageTypeForDestination = (destId: string): 'googleDrive' | 'oneDrive' | 'dropbox' => {
    switch (destId) {
      case '1':
      case '2':
        return 'dropbox';
      case '3':
      case '4':
        return 'googleDrive';
      case '5':
      case '6':
        return 'oneDrive';
      default:
        return 'dropbox';
    }
  };

  useEffect(() => {
    // Set the storage type based on destination
    const storageType = getStorageTypeForDestination(destinationId);
    setSelectedStorage(storageType);
    
    // Refresh connection status when component mounts
    dispatch(refreshConnectionStatus());
  }, [destinationId, dispatch]);

  const handleConnectionChange = (connected: boolean, storageType: 'googleDrive' | 'oneDrive' | 'dropbox') => {
    console.log(`${storageType} connection changed:`, connected);
    
    if (connected) {
      Alert.alert(
        'Csatlakoztatva!',
        `Most már tudsz fájlokat menteni a ${storageType === 'dropbox' ? 'Dropbox' : storageType === 'googleDrive' ? 'Google Drive' : 'OneDrive'}-ba.`,
        [{ text: 'OK' }]
      );
    }
  };

  const canSaveFiles = (): boolean => {
    if (!selectedStorage) return false;
    return connectionStatus[selectedStorage];
  };

  const handleTestConnection = async () => {
    if (!selectedStorage) return;
    
    if (canSaveFiles()) {
      Alert.alert(
        'Kapcsolat aktív',
        `A ${selectedStorage === 'dropbox' ? 'Dropbox' : selectedStorage === 'googleDrive' ? 'Google Drive' : 'OneDrive'} kapcsolat aktív és használatra kész.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Nincs kapcsolat',
        `Kérlek csatlakoztasd a ${selectedStorage === 'dropbox' ? 'Dropbox' : selectedStorage === 'googleDrive' ? 'Google Drive' : 'OneDrive'}-ot a fájlok mentéséhez.`,
        [{ text: 'OK' }]
      );
    }
  };

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

        {/* Cloud Storage Connection */}
        {selectedStorage && (
          <View style={styles.storageContainer}>
            <Text style={styles.storageTitle}>Cloud Storage</Text>
            <CloudStorageConnector
              storageType={selectedStorage}
              onConnectionChange={handleConnectionChange}
              style={styles.storageConnector}
            />
            
            {/* Connection Status Info */}
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {canSaveFiles() 
                  ? '✅ Kész a fájlok mentésére' 
                  : '⚠️ Csatlakoztatás szükséges a mentéshez'
                }
              </Text>
              <Button
                title="Kapcsolat tesztelése"
                variant="outline"
                size="small"
                onPress={handleTestConnection}
                buttonStyle={styles.testButton}
              />
            </View>
          </View>
        )}

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
  storageContainer: {
    marginBottom: 30,
  },
  storageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  storageConnector: {
    marginBottom: 15,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 12,
  },
  testButton: {
    minWidth: 100,
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