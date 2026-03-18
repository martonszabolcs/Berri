import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  AppState,
} from 'react-native';
import { showSuccessToast, showErrorToast } from '../utils/toast';
import { Layout, Text, DestinationIcon, Button } from '../components';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  useNavigation,
  useRoute,
  CommonActions,
} from '@react-navigation/native';

import { sendFilesApiService } from '../store/api/sendFilesApi';
import { setHistory, refreshUser } from '../store/appSlice';
import { store } from '../store/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processFileNameTemplate } from '../utils/saveImage';
import { saveDropboxToken, saveOneDriveToken } from '../store/settingsSlice';
import { DROPBOX_CLIENT, ONEDRIVE_CLIENT } from '../config';

type RouteParams = {
  savedFilePath?: string;
  savedFilePaths?: string[];
  destinationType?: number | number[];
};

const DestinationSelectScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const {
    savedFilePath,
    savedFilePaths,
    destinationType = [1],
  } = route.params as RouteParams;

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
    setSelectedDestinations(
      Array.isArray(destinationType) ? destinationType : [destinationType],
    );
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
      const history = await AsyncStorage.getItem('history');
      const historyArray = history ? JSON.parse(history) : [];

      const newEntry = {
        timestamp: Date.now(),
        files: data.files.map(filePath => {
          const filename = filePath.split('/').pop() || 'unknown_file';
          return {
            url: filename,
            filename: filename,
          };
        }),
        destinations: data.destinations,
      };
      historyArray.push(newEntry);

      await AsyncStorage.setItem('history', JSON.stringify(historyArray));
      dispatch(setHistory(historyArray));
      console.log(
        '💾 Saving files to AsyncStorage:',
        data.files,
        'to destinations:',
        data.destinations,
      );
    } catch (error) {
      console.error('❌ Error saving files to AsyncStorage:', error);
    }
  };

  const sendFileToDestination = async (
    filterDestinationType?: string,
    newSettings?: any,
  ) => {
    if (!selectedDestinations || selectedDestinations.length === 0) {
      console.warn('No destinations selected');

      //save to local
      await saveFilesToAsyncstorage({
        files: allFilePaths,
        destinations: selectedDestinations,
      });

      // Navigate to History tab AND reset the NewScanStack back to CameraScreen (init state)
      // const parentNavigation = navigation.getParent();
      // if (parentNavigation) {
      //   // First reset the NewScanStack so CameraScreen starts fresh
      //   navigation.dispatch(
      //     CommonActions.reset({
      //       index: 0,
      //       routes: [{ name: 'CameraScreen' }],
      //     }),
      //   );
      //   // Then switch to History tab
      //   parentNavigation.navigate('History');
      // }
      navigation.navigate('MainTabs', {
        screen: 'History',
      });
      return;
    }

    if (isSending) {
      console.warn('Already sending, ignoring duplicate request');
      return;
    }
    setIsSending(true);

    try {
      // Refresh user data before sending to get latest destination settings
      await dispatch(refreshUser());
      // Re-read destinations from store after refresh
      const freshDestinations = store.getState().app.destinations;

      if (!filterDestinationType) {
        await saveFilesToAsyncstorage({
          files: allFilePaths,
          destinations: selectedDestinations,
        });
      }

      console.log(
        `Sending ${
          allFilePaths.length
        } file(s) to destination types ${selectedDestinations.join(', ')}`,
      );

      // TODO uniq email, dropbox, google drive, onedrive
      let finalSelectedDestinations = []
      for (const selectedDestinationType of selectedDestinations) {
        console.log(`📤 Processing destination ${selectedDestinationType}...`);

        let destinationConfig = freshDestinations.find(
          (dest: any) => dest.type === selectedDestinationType,
        );

        if (!destinationConfig) {
          console.log(
            `📧 User has no destination of type ${selectedDestinationType}, creating email destination with user email`,
          );

          try {
            const { updateDestinationSettings } = await import(
              '../store/api/userApiService'
            );
            const success = await updateDestinationSettings(
              selectedDestinationType.toString(),
              {
                destination: 'email',
                emails: user.email,
              },
            );

            if (success) {
              console.log('✅ Email destination created successfully');
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
        finalSelectedDestinations.push(finalDest)
      }

const uniqSelectedDestinations = finalSelectedDestinations.filter(
  (current, index, self) => {
    // Minden korábbi elem, amit összehasonlítunk
    const isDuplicate = self.slice(0, index).some(prev => {
      // Ha destination különbözik, ok
      if (prev.destination !== current.destination) return false;

      // Ha destination email, akkor csak akkor duplikált, ha ugyanaz az emails tömb
      if (current.destination === 'email') {
        // Egyszerű összehasonlítás: JSON.stringify
        return JSON.stringify(prev.emails) === JSON.stringify(current.emails);
      }

      // Minden más destination esetén csak a destination alapján szűrünk
      return true;
    });

    return !isDuplicate;
  }
);
      for (const uniqDest of uniqSelectedDestinations) {
        const finalDest = uniqDest;

        if (
          filterDestinationType &&
          finalDest.destination !== filterDestinationType
        ) {
          console.log(
            `Skipping destination ${uniqDest.type} as it does not match specified type ${filterDestinationType}`,
          );
          continue;
        }

        if (finalDest.destination === 'email') {
          console.log('📧 Sending via email to:', finalDest.emails);

          try {
            const fileNameTemplate =
              settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
            const processedTemplate = processFileNameTemplate(fileNameTemplate);

            const newFileArray = allFilePaths.map((filePath, index) => {
              // Add unique timestamp to ensure uniqueness
              const now = new Date();
              const hh = String(now.getHours()).padStart(2, '0');
              const mm = String(now.getMinutes()).padStart(2, '0');
              const ss = String(now.getSeconds()).padStart(2, '0');

              const timeString = `${hh}${mm}${ss}`; // pl. "142305"
              const fileName = `${processedTemplate}_${timeString}.jpg`;
              return { fileName, filePath };
            });

            console.log(
              '📧 Uploading via email...',
              newFileArray.length,
              'files',
            );
            await sendFilesApiService.uploadToEmail(newFileArray, finalDest);
            console.log('✅ Files sent via email successfully');
          } catch (error) {
            console.error('❌ Error sending via email:', error);
          }
        } else if (finalDest.destination === 'dropbox') {
          console.log('📤 Sending to Dropbox...');

          try {
            const fileNameTemplate =
              settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
            const processedTemplate = processFileNameTemplate(fileNameTemplate);

            const newFileArray = allFilePaths.map((filePath, index) => {
              // Add unique timestamp to ensure uniqueness
              const now = new Date();
              const hh = String(now.getHours()).padStart(2, '0');
              const mm = String(now.getMinutes()).padStart(2, '0');
              const ss = String(now.getSeconds()).padStart(2, '0');

              const timeString = `${hh}${mm}${ss}`; // pl. "142305"
              const fileName = `${processedTemplate}_${timeString}.jpg`;
              return { fileName, filePath };
            });

            const accessToken =
              newSettings?.dropboxAccessToken || settings.dropboxAccessToken;
            const refreshToken =
              newSettings?.dropboxRefreshToken || settings.dropboxRefreshToken;

            await sendFilesApiService.uploadToDropbox(
              accessToken,
              refreshToken,
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
            const fileNameTemplate =
              settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
            const processedTemplate = processFileNameTemplate(fileNameTemplate);

            const newFileArray = allFilePaths.map((filePath, index) => {
              // Add unique timestamp to ensure uniqueness
              const now = new Date();
              const hh = String(now.getHours()).padStart(2, '0');
              const mm = String(now.getMinutes()).padStart(2, '0');
              const ss = String(now.getSeconds()).padStart(2, '0');

              const timeString = `${hh}${mm}${ss}`; // pl. "142305"
              const fileName = `${processedTemplate}_${timeString}.jpg`;
              return { fileName, filePath };
            });

            const accessToken =
              newSettings?.oneDriveAccessToken || settings.oneDriveAccessToken;
            const refreshToken =
              newSettings?.oneDriveRefreshToken ||
              settings.oneDriveRefreshToken;

            await sendFilesApiService.uploadToOneDrive(
              accessToken,
              refreshToken,
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
            const fileNameTemplate =
              settings?.fileNaming || '{Berri}_{Year}_{Month}_{Day}';
            const processedTemplate = processFileNameTemplate(fileNameTemplate);

            const newFileArray = allFilePaths.map((filePath, index) => {
              // Add unique timestamp to ensure uniqueness
              const now = new Date();
              const hh = String(now.getHours()).padStart(2, '0');
              const mm = String(now.getMinutes()).padStart(2, '0');
              const ss = String(now.getSeconds()).padStart(2, '0');

              const timeString = `${hh}${mm}${ss}`; // pl. "142305"
              const fileName = `${processedTemplate}_${timeString}.jpg`;
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
          console.log(
            `📤 Sending to ${finalDest.destination} - not implemented yet`,
          );
        }
      }

      console.log('✅ All destinations processed successfully');
      showSuccessToast('Sent', 'Files have been sent successfully!');
    } catch (error) {
      console.error('❌ Error in sendFileToDestination:', error);
      showErrorToast('Send Failed', 'Failed to send files. Please try again.');
    } finally {
      setIsSending(false);
    }

    navigation.navigate('MainTabs', {
      screen: 'History',
    });

    // // Navigate to History tab AND reset the NewScanStack back to CameraScreen (init state)
    // const parentNavigation = navigation.getParent();
    // if (parentNavigation) {
    //   // First reset the NewScanStack so CameraScreen starts fresh
    //   navigation.dispatch(
    //     CommonActions.reset({
    //       index: 0,
    //       routes: [{ name: 'CameraScreen' }],
    //     })
    //   );
    //   // Then switch to History tab
    //   parentNavigation.navigate('History');
    // }
  };

  const clientId = DROPBOX_CLIENT;
  const oneDriveRedirectUri = 'berri://onedrive-auth';
  const oneDriveClientId = ONEDRIVE_CLIENT;

  const exchangeDropboxCodeForToken = useCallback(
    async (authCode: string, verifier: string) => {
      try {
        const tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
        const exactRedirectUri = 'berri://dropbox-auth';

        const body = new URLSearchParams({
          code: authCode,
          grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: exactRedirectUri,
          code_verifier: verifier,
        });

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        const data = await response.json();

        if (response.ok) {
          try {
            const tokens = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
            };

            await dispatch(saveDropboxToken(tokens)).unwrap();
            sendFilesApiService.setCodeVerifier(null);

            const updatedSettings = {
              ...settings,
              dropboxAccessToken: tokens.accessToken,
              dropboxRefreshToken: tokens.refreshToken,
            };

            try {
              await sendFileToDestination('dropbox', updatedSettings);
            } catch (error) {
              console.error('❌ Error resending files:', error);
              showErrorToast(
                'Resend Failed',
                'Failed to resend scan to Dropbox. Please try again.',
              );
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
    [
      clientId,
      dispatch,
      navigation,
      selectedDestinations,
      destinations,
      user,
      settings,
    ],
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
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

            const updatedSettings = {
              ...settings,
              oneDriveAccessToken: tokens.accessToken,
              oneDriveRefreshToken: tokens.refreshToken,
            };

            try {
              await sendFileToDestination('onedrive', updatedSettings);
              showSuccessToast(
                'Resent',
                'Scan has been resent to OneDrive successfully!',
              );
            } catch (error) {
              console.error('❌ Error resending files:', error);
              showErrorToast(
                'Resend Failed',
                'Failed to resend scan to OneDrive. Please try again.',
              );
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
    [
      oneDriveClientId,
      oneDriveRedirectUri,
      dispatch,
      navigation,
      selectedDestinations,
      destinations,
      user,
      settings,
    ],
  );

  useEffect(() => {
    const handleURL = (url: string) => {
      if (url.includes('dropbox-auth')) {
        const codeMatch = url.match(/code=([^&]+)/);
        const codeVerifierOutside = sendFilesApiService.getCodeVerifier();
        if (codeMatch && codeVerifierOutside) {
          const authCode = codeMatch[1];
          exchangeDropboxCodeForToken(authCode, codeVerifierOutside);
        }
      } else if (url.includes('onedrive-auth')) {
        const codeMatch = url.match(/code=([^&]+)/);
        const codeVerifierOutside = sendFilesApiService.getCodeVerifier();
        if (codeMatch && codeVerifierOutside) {
          const authCode = codeMatch[1];
          exchangeOneDriveCodeForToken(authCode, codeVerifierOutside);
        }
      }
    };

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        setTimeout(() => {
          Linking.getInitialURL().then(url => {
            if (url) handleURL(url);
          });
        }, 100);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleURL(url);
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    const urlSubscription = Linking.addEventListener('url', ({ url }) =>
      handleURL(url),
    );

    return () => {
      appStateSubscription.remove();
      urlSubscription.remove();
    };
  }, [dispatch, exchangeDropboxCodeForToken, exchangeOneDriveCodeForToken]);

  const getDestinationName = (dest: any) => {
    switch (dest.destination.toLowerCase()) {
      case 'dropbox':
        return 'Dropbox';
      case 'google_drive':
      case 'googledrive':
        return 'Google Drive';
      case 'onedrive':
        return 'OneDrive';
      default:
        return 'Email';
    }
  };

  // const navigation = useNavigation();

  // Hook mindig a komponens top-leveljén
  useLayoutEffect(() => {
    // Elrejti a tab bart
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });

    // Visszaállítás, amikor elhagyjuk
    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'flex' } });
    };
  }, [navigation]);

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
                    : [...prev, destination.type],
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
                    {getDestinationName(destination)}
                  </Text>
                  <Text style={styles.destinationText}>
                    {getDestinationName(destination) === 'Email' &&
                      (destination.emails || user.email)}
                  </Text>
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
          title={
            selectedDestinations.length === 0
              ? 'Next'
              : isSending
              ? 'Sending...'
              : 'Send'
          }
          onPress={() => sendFileToDestination()}
          variant="normal"
          size="large"
          buttonStyle={styles.sendButton}
          disabled={isSending}
        />
      </ScrollView>
    </Layout>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1 },
  destinationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 10,
  },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  arrowIcon: { width: 20, height: 20, tintColor: '#007BD1', marginRight: 20 },
  destinationInfo: { flex: 1 },
  destinationText: { fontSize: 12, fontWeight: '500', color: 'white' },
  sendButton: { margin: 20 },
});

export default DestinationSelectScreen;
