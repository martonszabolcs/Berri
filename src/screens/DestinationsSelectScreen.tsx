import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  AppState,
} from 'react-native';
import { Layout, Text, DestinationIcon, Button } from '../components';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { useNavigation, useRoute } from '@react-navigation/native';

import { sendFilesApiService } from '../store/api/sendFilesApi';
import { setHistory } from '../store/appSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processFileNameTemplate } from '../utils/saveImage';
import { saveDropboxToken, saveOneDriveToken } from '../store/settingsSlice';
import { DROPBOX_CLIENT, ONEDRIVE_CLIENT } from '../config';

type RouteParams = {
  savedFilePath: string;
  destinationType?: number | number[];
};

const DestinationSelectScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { savedFilePath, destinationType = [1] } = route.params as RouteParams;

  const destinations = useAppSelector(state => state.app.destinations);
  const user = useAppSelector(state => state.app.user);
  const settings = useAppSelector(state => state.app.settings);
  const [allDestinations, setAllDestinations] = useState<any[]>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<number[]>(
    Array.isArray(destinationType) ? destinationType : [destinationType],
  );

  // Log the received file path
  useEffect(() => {
    console.log(
      '📁 DestinationSelectScreen received file path:',
      savedFilePath,
    );
    setSelectedDestinations(Array.isArray(destinationType) ? destinationType : [destinationType]);
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
    destinations: number[];
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

  const sendFileToDestination = async (destinationType?: string, newSettings?: any) => {
    if (!selectedDestinations || selectedDestinations.length === 0) {
      console.warn('No destinations selected');
      return;
    }

    if (!destinationType) {
      await saveFilesToAsyncstorage({
        files: [savedFilePath],
        destinations: selectedDestinations,
      });

      console.log(
        `Sending file at ${savedFilePath} to destination types ${selectedDestinations.join(', ')}`,
      );
    }


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

      if (destinationType && finalDest.destination !== destinationType) {
        console.log(`Skipping destination ${selectedDestinationType} as it does not match specified type ${destinationType}`);
        continue;
      }

      // If destination is email, dispatch uploadAndSendFile
      if (finalDest.destination === 'email') {
        console.log('📧 Sending via email to:', user.email);

        try {
          // Create file array in the format expected by uploadToEmail
          const fileNameTemplate = settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
          const processedTemplate = processFileNameTemplate(fileNameTemplate);
          const timestamp = Date.now();
          const fileName = `${processedTemplate}_${timestamp}.jpg`;
          
          const newFileArray = [{ fileName, filePath: savedFilePath }];

          console.log('📧 Uploading via email using sendFilesApiService.uploadToEmail...');
          await sendFilesApiService.uploadToEmail(newFileArray, finalDest);
          console.log('✅ File sent via email successfully');
        } catch (error) {
          console.error('❌ Error sending via email:', error);
        }
      } else if (finalDest.destination === 'dropbox') {
        console.log('📤 Sending to Dropbox...');

        try {
          const fileNameTemplate = settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
          const processedTemplate = processFileNameTemplate(fileNameTemplate);
          const timestamp = Date.now();
          const fileName = `${processedTemplate}_${timestamp}.jpg`;

          const accesstoken = newSettings?.dropboxAccessToken || settings.dropboxAccessToken;
          const refreshtoken = newSettings?.dropboxRefreshToken || settings.dropboxRefreshToken;

          await sendFilesApiService.uploadToDropbox(
            accesstoken,
            refreshtoken,
            [{ fileName, filePath: savedFilePath }],
            finalDest,
          );
          console.log('✅ File uploaded to Dropbox successfully');
        } catch (error) {
          console.error('❌ Error uploading to Dropbox:', error);
        }
      } else if (finalDest.destination === 'onedrive') {
        console.log('📤 Sending to OneDrive...');

        try {
          const fileNameTemplate = settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
          const processedTemplate = processFileNameTemplate(fileNameTemplate);
          const timestamp = Date.now();
          const fileName = `${processedTemplate}_${timestamp}.jpg`;

          const accesstoken = newSettings?.oneDriveAccessToken || settings.oneDriveAccessToken;
          const refreshtoken = newSettings?.oneDriveRefreshToken || settings.oneDriveRefreshToken;

          await sendFilesApiService.uploadToOneDrive(
            accesstoken,
            refreshtoken,
            [{ fileName, filePath: savedFilePath }],
            finalDest,
          );
          console.log('✅ File uploaded to OneDrive successfully');
        } catch (error) {
          console.error('❌ Error uploading to OneDrive:', error);
        }
      } else if (finalDest.destination === 'googledrive') {
        console.log('📤 Sending to Google drive...');
        try {
          const fileNameTemplate = settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
          const processedTemplate = processFileNameTemplate(fileNameTemplate);
          const timestamp = Date.now();
          const fileName = `${processedTemplate}_${timestamp}.jpg`;
          await sendFilesApiService.uploadToGoogleDrive(
            settings.googleDriveAccessToken,
            settings.googleDriveRefreshToken,
            [{ fileName, filePath: savedFilePath }],
            finalDest,
          );
          console.log('✅ File uploaded to Google Drive successfully');
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
    // Navigate to History tab after successful send
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('History');
    }
  };

  // handle deeplink if user has to log in again
  // Dropbox OAuth configuration
  const clientId = DROPBOX_CLIENT;

  // OneDrive OAuth configuration
  const oneDriveRedirectUri = 'berri://onedrive-auth';
  const oneDriveClientId = ONEDRIVE_CLIENT;

  const exchangeDropboxCodeForToken = useCallback(
    async (authCode: string, verifier: string) => {
      try {
        const tokenUrl = 'https://api.dropboxapi.com/oauth2/token';

        // IMPORTANT: Use the EXACT same redirect_uri as in the authorization request
        const exactRedirectUri = 'berri://dropbox-auth'; // Must match authorization request
        
        const body = new URLSearchParams({
          code: authCode,
          grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: exactRedirectUri, // Use exact match
          code_verifier: verifier,
        });

        console.log('🔄 Token exchange request details:', {
          authCode: authCode,
          clientId: clientId,
          redirectUri: exactRedirectUri,
          codeVerifierLength: verifier.length,
          codeVerifierPreview: verifier.substring(0, 15) + '...'
        });

        console.log('📤 Sending token exchange request to:', tokenUrl);
        console.log('📤 Request body:', body.toString());
        
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });

        const data = await response.json();
        
        console.log('📥 Token exchange response:', {
          status: response.status,
          ok: response.ok,
          data: data
        });

        if (response.ok) {
          try {
            const tokens = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
            };

            await dispatch(saveDropboxToken(tokens)).unwrap();
            sendFilesApiService.setCodeVerifier(null);

            // Create updated settings with new Dropbox tokens
            const updatedSettings = {
              ...settings,
              dropboxAccessToken: tokens.accessToken,
              dropboxRefreshToken: tokens.refreshToken
            };

            console.log('🔄 Using fresh Dropbox tokens for resend:', {
              hasNewAccessToken: !!tokens.accessToken,
              hasNewRefreshToken: !!tokens.refreshToken
            });

            try {
              await sendFileToDestination("dropbox", updatedSettings);

              
            } catch (error) {
              console.error('❌ Error resending files:', error);
              Alert.alert('Error', 'Failed to resend scan. Please try again.');
            }
          } catch (error) {
            console.error('❌ Failed to save Dropbox tokens:', error);
          }
        } else {
          console.error('❌ Token exchange failed:', data);
        }
      } catch (error) {
        console.error('❌ Error during token exchange:', error);
      }
    },
    [clientId, dispatch, navigation, selectedDestinations, destinations, user, settings],
  );

  const exchangeOneDriveCodeForToken = useCallback(
    async (authCode: string, verifier: string) => {
      try {
        const tokenUrl =
          'https://login.microsoftonline.com/common/oauth2/v2.0/token';

        const body = new URLSearchParams({
          code: authCode,
          client_id: oneDriveClientId,
          redirect_uri: oneDriveRedirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        });

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });

        const data = await response.json();

        if (response.ok) {
          try {
            const tokens = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
            };

            await dispatch(saveOneDriveToken(tokens)).unwrap();
            sendFilesApiService.setCodeVerifier(null);

            // Create updated settings with new OneDrive tokens
            const updatedSettings = {
              ...settings,
              oneDriveAccessToken: tokens.accessToken,
              oneDriveRefreshToken: tokens.refreshToken
            };

            console.log('🔄 Using fresh OneDrive tokens for resend:', {
              hasNewAccessToken: !!tokens.accessToken,
              hasNewRefreshToken: !!tokens.refreshToken
            });

            // Based on screen:
            try {
              await sendFileToDestination("onedrive", updatedSettings);

              Alert.alert('Success', 'Scan has been resent successfully!', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              console.error('❌ Error resending files:', error);
              Alert.alert('Error', 'Failed to resend scan. Please try again.');
            }
          } catch (error) {
            console.error('❌ Failed to save OneDrive tokens:', error);
          }
        } else {
          console.error('❌ OneDrive token exchange failed:', data);
        }
      } catch (error) {
        console.error('❌ Error during OneDrive token exchange:', error);
      }
    },
    [oneDriveClientId, oneDriveRedirectUri, dispatch, navigation, selectedDestinations, destinations, user, settings],
  );

  useEffect(() => {
    const handleURL = (url: string) => {
      if (url.includes('dropbox-auth')) {
        const codeMatch = url.match(/code=([^&]+)/);
        const codeVerifierOutside = sendFilesApiService.getCodeVerifier();
        if (codeMatch && codeVerifierOutside) {
          const authCode = codeMatch[1];
          console.log('🔑 Retrieved code verifier for Dropbox:', codeVerifierOutside);
          console.log('🔑 Exchanging Dropbox auth code for token:', authCode);
          exchangeDropboxCodeForToken(authCode, codeVerifierOutside);
        } else if (codeMatch && !codeVerifierOutside) {
          console.error(
            '❌ Code verifier not found! Cannot exchange code for token.',
          );
        }
      } else if (url.includes('onedrive-auth')) {
        const codeMatch = url.match(/code=([^&]+)/);
        const codeVerifierOutside = sendFilesApiService.getCodeVerifier();
        if (codeMatch && codeVerifierOutside) {
          const authCode = codeMatch[1];
          exchangeOneDriveCodeForToken(authCode, codeVerifierOutside);
        } else if (codeMatch && !codeVerifierOutside) {
          console.error(
            '❌ Code verifier not found! Cannot exchange OneDrive code for token.',
          );
        }
      }
    };

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        setTimeout(() => {
          Linking.getInitialURL().then(url => {
            if (url) {
              handleURL(url);
            }
          });
        }, 100);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) {
        handleURL(url);
      }
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleURL(url);
    });

    return () => {
      appStateSubscription.remove();
      urlSubscription.remove();
    };
  }, [dispatch, exchangeDropboxCodeForToken, exchangeOneDriveCodeForToken]);


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
          title={`Send`}
          onPress={() => sendFileToDestination()}
          variant="normal"
          size="large"
          buttonStyle={styles.sendButton}
          disabled={selectedDestinations.length === 0}
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
