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

import { sendFilesApiService } from '../store/api/sendFilesApi';
import { setHistory } from '../store/appSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processFileNameTemplate } from '../utils/saveImage';

type RouteParams = {
  savedFilePath?: string;
  savedFilePaths?: string[];
  destinationType?: number | number[];
};

const DestinationSelectScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { savedFilePath, savedFilePaths, destinationType = [1] } = route.params as RouteParams;
  
  // Support both single file and multiple files
  const allFilePaths = savedFilePaths || (savedFilePath ? [savedFilePath] : []);

  const destinations = useAppSelector(state => state.app.destinations);
  const user = useAppSelector(state => state.app.user);
  const settings = useAppSelector(state => state.app.settings);
  const [allDestinations, setAllDestinations] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<number[]>(
    Array.isArray(destinationType) ? destinationType : [destinationType],
  );

  // Log the received file path(s)
  useEffect(() => {
    console.log(
      '📁 DestinationSelectScreen received file paths:',
      allFilePaths,
    );
    setSelectedDestinations(Array.isArray(destinationType) ? destinationType : [destinationType]);
  }, [allFilePaths, destinationType]);

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
    destinations: number[];
  }) => {
    try {
      // read asyncstorage history
      const history = await AsyncStorage.getItem('history');
      const historyArray = history ? JSON.parse(history) : [];

      // append new data - save only filename for portability
      const newEntry = {
        timestamp: Date.now(),
        files: data.files.map(filePath => {
          const filename = filePath.split('/').pop() || 'unknown_file';
          return {
            url: filename, // Store only filename, not full path (path changes on reinstall)
            filename: filename,
          };
        }),
        destinations: data.destinations, // Now array of destinations
      };
      historyArray.push(newEntry);

      // save back to asyncstorage
      await AsyncStorage.setItem('history', JSON.stringify(historyArray));
      // reload new data to redux slice
      dispatch(setHistory(historyArray));
      console.log('💾 Saving files to AsyncStorage:', data.files, 'to destinations:', data.destinations);
    } catch (error) {
      console.error('❌ Error saving files to AsyncStorage:', error);
    }
  };

  const sendFileToDestination = async () => {
    if (!selectedDestinations || selectedDestinations.length === 0) {
      console.warn('No destinations selected');
      return;
    }

    // Prevent double submission
    if (isSending) {
      console.warn('Already sending, ignoring duplicate request');
      return;
    }
    setIsSending(true);

    try {
      await saveFilesToAsyncstorage({
        files: allFilePaths,
        destinations: selectedDestinations,
      });

    console.log(
      `Sending ${allFilePaths.length} file(s) to destination types ${selectedDestinations.join(', ')}`,
    );

    // Send to all selected destinations
    for (const selectedDestinationType of selectedDestinations) {
      console.log(`📤 Processing destination ${selectedDestinationType}...`);
      
      // Find the selected destination
      // const selectedDest = allDestinations.find(
      //   dest => dest.type === selectedDestinationType,
      // );

      // if (!selectedDest) {
      //   console.error(`Selected destination ${selectedDestinationType} not found`);
      //   continue;
      // }

      // Check if destination exists, create if needed
      let destinationConfig = destinations.find(dest => dest.type === selectedDestinationType);
      
      if (!destinationConfig) {
        console.log(`📧 User has no destination of type ${selectedDestinationType}, creating email destination with user email`);
        
        try {
          // Use the same API as ChangeDestinationScreen
          const { updateDestinationSettings } = await import('../store/api/userApiService');
          
          const success = await updateDestinationSettings(selectedDestinationType.toString(), {
            destination: 'email',
            emails: user.email,
          });
          
          if (success) {
            console.log('✅ Email destination created successfully');
            // Refresh user data to get updated destinations
            const { refreshUser } = await import('../store/appSlice');
            await dispatch(refreshUser());
          } else {
            console.error('❌ Failed to create email destination');
          }
        } catch (error) {
          console.error('❌ Error creating email destination:', error);
        }
      }

      const fallbackDestination = {
        type: selectedDestinationType,
        destination: 'email',
        emails: user.email,
      };
      const finalDest = destinationConfig || fallbackDestination;

      // If destination is email, dispatch uploadAndSendFile
      if (finalDest.destination === 'email') {
        console.log('📧 Sending via email to:', user.email);

        try {
          // Create file array in the format expected by uploadToEmail
          const fileNameTemplate = settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
          const processedTemplate = processFileNameTemplate(fileNameTemplate);
          
          // Build array from ALL file paths
          const newFileArray = allFilePaths.map((filePath, index) => {
            const timestamp = Date.now() + index; // Unique timestamp for each file
            const fileName = `${processedTemplate}_${timestamp}.jpg`;
            return { fileName, filePath };
          });

          console.log('📧 Uploading via email using sendFilesApiService.uploadToEmail...', newFileArray.length, 'files');
          await sendFilesApiService.uploadToEmail(newFileArray, finalDest);
          console.log('✅ Files sent via email successfully');
        } catch (error) {
          console.error('❌ Error sending via email:', error);
        }
      } else if (finalDest.destination === 'dropbox') {
        console.log('📤 Sending to Dropbox...');

        try {
          const fileNameTemplate = settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
          const processedTemplate = processFileNameTemplate(fileNameTemplate);
          
          // Build array from ALL file paths
          const newFileArray = allFilePaths.map((filePath, index) => {
            const timestamp = Date.now() + index;
            const fileName = `${processedTemplate}_${timestamp}.jpg`;
            return { fileName, filePath };
          });
          
          await sendFilesApiService.uploadToDropbox(
            settings.dropboxAccessToken,
            settings.dropboxRefreshToken,
            newFileArray,
            finalDest,
          );
          console.log('✅ Files uploaded to Dropbox successfully');
        } catch (error) {
          console.error('❌ Error uploading to Dropbox:', error);
        }
      } else if (finalDest.destination === 'onedrive') {
        console.log('📤 Sending to OneDrive...');

        try {
          const fileNameTemplate = settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
          const processedTemplate = processFileNameTemplate(fileNameTemplate);
          
          // Build array from ALL file paths
          const newFileArray = allFilePaths.map((filePath, index) => {
            const timestamp = Date.now() + index;
            const fileName = `${processedTemplate}_${timestamp}.jpg`;
            return { fileName, filePath };
          });
          
          await sendFilesApiService.uploadToOneDrive(
            settings.oneDriveAccessToken,
            settings.oneDriveRefreshToken,
            newFileArray,
            finalDest,
          );
          console.log('✅ Files uploaded to OneDrive successfully');
        } catch (error) {
          console.error('❌ Error uploading to OneDrive:', error);
        }
      } else if (finalDest.destination === 'googledrive') {
        console.log('📤 Sending to Google drive...');
        try {
          const fileNameTemplate = settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
          const processedTemplate = processFileNameTemplate(fileNameTemplate);
          
          // Build array from ALL file paths
          const newFileArray = allFilePaths.map((filePath, index) => {
            const timestamp = Date.now() + index;
            const fileName = `${processedTemplate}_${timestamp}.jpg`;
            return { fileName, filePath };
          });
          
          await sendFilesApiService.uploadToGoogleDrive(
            settings.googleDriveAccessToken,
            settings.googleDriveRefreshToken,
            newFileArray,
            finalDest,
          );
          console.log('✅ Files uploaded to Google Drive successfully');
        } catch (error) {
          console.error('❌ Error uploading to Google Drive:', error);
        }
      } else {
        // Handle other destination types
        console.log(
          `📤 Sending to ${finalDest.destination} - not implemented yet`,
        );
      }
    }

    console.log('✅ All destinations processed successfully');
    } catch (error) {
      console.error('❌ Error in sendFileToDestination:', error);
    } finally {
      setIsSending(false);
    }
    
    // Navigate to History tab after successful send
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('History');
    }
  };

  return (
    <Layout type="dark" headerTitle="Where should we send your scans?">
      <ScrollView>
        <View style={styles.content}>
          {allDestinations.map((destination: any) => (
            <TouchableOpacity
              key={destination.type}
              style={[styles.destinationCard]}
              onPress={() => {
                setSelectedDestinations(prev => 
                  prev.includes(destination.type)
                    ? prev.filter(id => id !== destination.type)
                    : [...prev, destination.type]
                );
              }}
            >
              <View style={styles.cardContent}>
                <DestinationIcon
                  type={destination.type}
                  variant={
                    selectedDestinations.includes(destination.type)
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
                {selectedDestinations.includes(destination.type) && (
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
          title={isSending ? 'Sending...' : 'Send'}
          onPress={() => sendFileToDestination()}
          variant="normal"
          size="large"
          buttonStyle={styles.sendButton}
          disabled={selectedDestinations.length === 0 || isSending}
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
  sendButton: {
    margin: 20,
  },
});

export default DestinationSelectScreen;
