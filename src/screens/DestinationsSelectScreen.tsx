import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Layout, Text, DestinationIcon, Button } from '../components';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { useNavigation, useRoute } from '@react-navigation/native';
import { uploadAndSendFile } from '../store/uploadSlice';
import { sendFilesApiService } from '../store/api/sendFilesApi';
import { setHistory } from '../store/appSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RouteParams = {
  savedFilePath: string;
  destinationType?: number;
};

const DestinationSelectScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { savedFilePath, destinationType = 1 } = route.params as RouteParams;

  const destinations = useAppSelector(state => state.app.destinations);
  const user = useAppSelector(state => state.app.user);
  const settings = useAppSelector(state => state.app.settings);
  const [allDestinations, setAllDestinations] = useState<any[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<number | null>(
    destinationType,
  );

  // Log the received file path
  useEffect(() => {
    console.log(
      '📁 DestinationSelectScreen received file path:',
      savedFilePath,
    );
    setSelectedDestination(destinationType);
  }, [savedFilePath, destinationType]);

  useEffect(() => {
    const all = [1, 2, 3, 4, 5, 6, 7];
    const allDest = all.map(type => {
      const savedDest = destinations.find(dest => dest.type === type);
      return savedDest
        ? { ...savedDest, saved: true }
        : { type, destination: 'email', emails: user.email, saved: false };
    });
    setAllDestinations(allDest);
  }, [destinations, user.email]);

  const saveFilesToAsyncstorage = async (data: {
    files: string[];
    destination: number;
  }) => {
    try {
      // read asyncstorage history
      const history = await AsyncStorage.getItem('history');
      const historyArray = history ? JSON.parse(history) : [];

      // append new data
      const newEntry = {
        timestamp: Date.now(),
        files: data.files.map(filePath => ({
          url: filePath.replace('file://', ''), // Remove file:// prefix for cross-platform compatibility
          filename: filePath.split('/').pop() || 'unknown_file',
        })),
        destination: data.destination,
      };
      historyArray.push(newEntry);

      // save back to asyncstorage
      await AsyncStorage.setItem('history', JSON.stringify(historyArray));
      // reload new data to redux slice
      dispatch(setHistory(historyArray));
      console.log('💾 Saving files to AsyncStorage:', data.files);
    } catch (error) {
      console.error('❌ Error saving files to AsyncStorage:', error);
    }
  };

  const sendFileToDestination = async () => {
    if (!selectedDestination) {
      console.warn('No destination selected');
      return;
    }

    await saveFilesToAsyncstorage({
      files: [savedFilePath],
      destination: selectedDestination,
    });

    console.log(
      `Sending file at ${savedFilePath} to destination type ${selectedDestination}`,
    );

    // Find the selected destination
    const selectedDest = allDestinations.find(
      dest => dest.type === selectedDestination,
    );

    if (!selectedDest) {
      console.error('Selected destination not found');
      return;
    }

    // If destination is email, dispatch uploadAndSendFile
    if (selectedDest.destination === 'email') {
      console.log('📧 Sending via email to:', selectedDest.emails);

      try {
        // Create a file object from the saved file path
        const fileName = `BERRI_Document_${Date.now()}.jpg`;
        const fileObject = {
          uri: `file://${savedFilePath}`,
          name: fileName,
          type: 'image/jpeg',
        };

        console.log('📁 File object created:', {
          name: fileObject.name,
          type: fileObject.type,
          uri: fileObject.uri,
        });

        const result = await dispatch(
          uploadAndSendFile({
            type: selectedDest.type,
            file: fileObject,
          }),
        );

        if (uploadAndSendFile.fulfilled.match(result)) {
          console.log('✅ File sent successfully:', result.payload);
          navigation.navigate('History');
        } else {
          console.error('❌ Failed to send file:', result.error);
        }
      } catch (error) {
        console.error('❌ Error sending file:', error);
      }
    } else if (selectedDest.destination === 'dropbox') {
      console.log('📤 Sending to Dropbox...');

      try {
        const fileName = `BERRI_Document_${Date.now()}.jpg`;
        await sendFilesApiService.uploadToDropbox(
          settings.dropboxAccessToken,
          settings.dropboxRefreshToken,
          fileName,
          savedFilePath,
        );
        console.log('✅ File uploaded to Dropbox successfully');
      } catch (error) {
        console.error('❌ Error uploading to Dropbox:', error);
      }
    } else if (selectedDest.destination === 'onedrive') {
      console.log('📤 Sending to OneDrive...');

      try {
        const fileName = `BERRI_Document_${Date.now()}.jpg`;
        await sendFilesApiService.uploadToOneDrive(
          settings.oneDriveAccessToken,
          settings.oneDriveRefreshToken,
          fileName,
          savedFilePath,
        );
        console.log('✅ File uploaded to OneDrive successfully');
      } catch (error) {
        console.error('❌ Error uploading to OneDrive:', error);
      }
    } else if (selectedDest.destination === 'googledrive') {
      console.log('📤 Sending to Google drive...');
      try {
        const fileName = `BERRI_Document_${Date.now()}.jpg`;
        await sendFilesApiService.uploadToGoogleDrive(
          settings.googleDriveAccessToken,
          settings.googleDriveRefreshToken,
          fileName,
          savedFilePath,
        );
        console.log('✅ File uploaded to Google Drive successfully');
      } catch (error) {
        console.error('❌ Error uploading to Google Drive:', error);
      }


    } else {
      // Handle other destination types (Google Drive, Dropbox, etc.)
      console.log(
        `📤 Sending to ${selectedDest.destination} - not implemented yet`,
      );
    }

    navigation.navigate('History');
  };

  return (
    <Layout type="dark" headerTitle="Where should we send your scans?">
      <ScrollView>
        <View style={styles.content}>
          {allDestinations.map((destination: any) => (
            <TouchableOpacity
              key={destination.type}
              style={[styles.destinationCard]}
              onPress={() => setSelectedDestination(destination.type)}
            >
              <View style={styles.cardContent}>
                <DestinationIcon
                  type={destination.type}
                  variant={
                    selectedDestination === destination.type
                      ? 'screen-selected'
                      : 'screen'
                  }
                />
                <View style={styles.destinationInfo}>
                  <Text style={styles.destinationText}>
                    {destination.destination === 'email'
                      ? 'E-mail'
                      : destination.destination}
                  </Text>
                  <Text style={styles.destinationText}>{user.email}</Text>
                </View>
                {selectedDestination === destination.type && (
                  <Image
                    resizeMode="contain"
                    source={require('../assets/select-destination.png')}
                    style={styles.arrowIcon}
                  />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <Button
          title="Next"
          onPress={() => sendFileToDestination()}
          variant="normal"
          size="large"
          style={{ margin: 20 }}
        />
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
    tintColor: '#007BD1',
    marginRight: 20,
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

export default DestinationSelectScreen;
