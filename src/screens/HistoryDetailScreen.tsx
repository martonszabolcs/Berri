import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  AppState,
  Linking,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Dirs } from 'react-native-file-access';
import { Layout, Text, DestinationIcon } from '../components';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { showErrorToast, showSuccessToast, showInfoToast } from '../utils/toast';

import { sendFilesApiService } from '../store/api/sendFilesApi';
import {
  deleteHistoryEntry,
  updateHistoryDestination,
} from '../utils/historyUtils';
import { saveDropboxToken, saveOneDriveToken } from '../store/settingsSlice';
import { DROPBOX_CLIENT, ONEDRIVE_CLIENT } from '../config';

interface FileInfo {
  filename: string;
  url: string;
}

// Helper to build full file path from filename or url
const getFullFilePath = (file: FileInfo): string => {
  const urlOrFilename = file.url || file.filename;
  // If it's already a full path (contains /), use it as-is
  if (urlOrFilename.includes('/')) {
    return `file://${urlOrFilename}`;
  }
  // Otherwise, it's just a filename - build full path from Documents dir
  return `file://${Dirs.DocumentDir}/${urlOrFilename}`;
};

interface HistoryEntry {
  timestamp: number;
  destination?: number; // Legacy support
  destinations?: number[]; // New multi-destination support
  files: FileInfo[];
}

type RootStackParamList = {
  HistoryDetailScreen: {
    history: HistoryEntry;
  };
  History: undefined;
};

type HistoryDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  'HistoryDetailScreen'
>;
type HistoryDetailScreenNavigationProp =
  StackNavigationProp<RootStackParamList>;

const HistoryDetailScreen = () => {
  const navigation = useNavigation<HistoryDetailScreenNavigationProp>();
  const route = useRoute<HistoryDetailScreenRouteProp>();
  const { history } = route.params;
  const dispatch = useAppDispatch();
  const destinations = useAppSelector(state => state.app.destinations);
  const user = useAppSelector(state => state.app.user);
  const settings = useAppSelector(state => state.app.settings);
  const currentHistory = useAppSelector(state => state.app.history);

  const [selectedDestinations, setSelectedDestinations] = useState<number[]>(
    history.destinations || (history.destination ? [history.destination] : []),
  );
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const displayName = `${history.files?.[0]?.filename}`;
  const displayDate = new Date(history.timestamp).toLocaleDateString();

  const toggleDestination = async (destinationId: number) => {
    let newSelectedDestinations: number[] = [];
    
    setSelectedDestinations(prev => {
      if (prev.includes(destinationId)) {
        newSelectedDestinations = prev.filter(id => id !== destinationId);
      } else {
        newSelectedDestinations = [...prev, destinationId];
      }
      return newSelectedDestinations;
    });

    try {
      await updateHistoryDestination(
        history,
        newSelectedDestinations,
        currentHistory,
        dispatch,
      );
    } catch (error) {
      console.error('❌ Error updating history destination:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Scan', 'Are you sure you want to delete this scan?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHistoryEntry(history, currentHistory, dispatch);
            showSuccessToast('Scan Deleted', 'The scan has been removed');
            navigation.goBack();
          } catch (error) {
            console.error('❌ Error deleting history entry:', error);
            showErrorToast('Delete Failed', 'Could not delete scan. Please try again.');
          }
        },
      },
    ]);
  };

  const handleResend = async () => {
    if (selectedDestinations.length === 0) {
      showInfoToast(
        'No Destinations',
        'Please select at least one destination',
      );
      return;
    }

    Alert.alert(
      'Resend Scan',
      `Resend this scan to ${selectedDestinations.length} destination(s)?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Resend',
          onPress: async () => {
            try {
              await sendFilesApiService.resendToDestination(
                selectedDestinations,
                destinations,
                history,
                user,
                settings,
                dispatch,
              );

              showSuccessToast('Scan Sent!', 'Successfully resent to destination(s)');
              setTimeout(() => navigation.goBack(), 1500);
            } catch (error) {
              console.error('❌ Error resending files:', error);
              showErrorToast('Resend Failed', 'Could not send scan. Please try again.');
            }
          },
        },
      ],
    );
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
              await sendFilesApiService.resendToDestination(
                selectedDestinations,
                destinations,
                history,
                user,
                updatedSettings, // Use fresh tokens!
                dispatch,
              );

              showSuccessToast('Scan Sent!', 'Successfully resent via Dropbox');
              setTimeout(() => navigation.goBack(), 1500);
            } catch (error) {
              console.error('❌ Error resending files:', error);
              showErrorToast('Resend Failed', 'Could not send scan. Please try again.');
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
    [clientId, dispatch, navigation, selectedDestinations, destinations, history, user, settings],
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
              await sendFilesApiService.resendToDestination(
                selectedDestinations,
                destinations,
                history,
                user,
                updatedSettings, // Use fresh tokens!
                dispatch,
              );

              showSuccessToast('Scan Sent!', 'Successfully resent via OneDrive');
              setTimeout(() => navigation.goBack(), 1500);
            } catch (error) {
              console.error('❌ Error resending files:', error);
              showErrorToast('Resend Failed', 'Could not send scan. Please try again.');
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
    [oneDriveClientId, oneDriveRedirectUri, dispatch, navigation, selectedDestinations, destinations, history, user, settings],
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
    <Layout type="default" headerTitle={'Detail'} showBackButton={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Title and Date */}
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{displayName}</Text>
          <Text style={styles.createdAt}>{displayDate}</Text>
        </View>

        {/* Images - show all files */}
        <View style={styles.imagesContainer}>
          {history.files && history.files.length > 0 ? (
            history.files.map((file, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.imageContainer}
                onPress={() => setZoomImageUri(getFullFilePath(file))}
                activeOpacity={0.9}
              >
                <View style={styles.imageWrapper}>
                  <Image
                    source={{ uri: getFullFilePath(file) }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.imageContainer}>
              <View style={[styles.image, styles.noImageContainer]}>
                <Text style={styles.noImageText}>No images available</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Zoom Modal */}
      <Modal
        visible={!!zoomImageUri}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setZoomImageUri(null)}
      >
        <View style={styles.zoomModalContainer}>
          <TouchableOpacity
            style={styles.zoomCloseButton}
            onPress={() => setZoomImageUri(null)}
          >
            <Text style={styles.zoomCloseText}>✕</Text>
          </TouchableOpacity>
          <ScrollView
            style={styles.zoomScrollView}
            contentContainerStyle={styles.zoomScrollContent}
            maximumZoomScale={5}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent={true}
            bouncesZoom={true}
          >
            {zoomImageUri && (
              <Image
                source={{ uri: zoomImageUri }}
                style={{
                  width: screenWidth,
                  height: screenHeight * 0.8,
                  borderRadius: 4,
                }}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Image
            source={require('../assets/trash.png')}
            style={styles.deleteIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Destination Icons */}
        <View style={styles.destinationsContainer}>
          {[1, 2, 3, 4, 5, 6, 7].map(destinationId => (
            <TouchableOpacity
              key={destinationId}
              onPress={() => toggleDestination(destinationId)}
            >
              <DestinationIcon
                type={destinationId as 1 | 2 | 3 | 4 | 5 | 6 | 7}
                variant={
                  selectedDestinations.includes(destinationId)
                    ? 'history-active'
                    : 'history'
                }
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Resend Button */}
        <TouchableOpacity style={styles.resendButton} onPress={handleResend}>
          <Image
            source={require('../assets/resend.png')}
            style={styles.resendIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerInfo: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  createdAt: {
    fontSize: 14,
    opacity: 0.7,
  },
  imagesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  imageContainer: {
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  image: {
    width: '100%',
    height: 400,
    borderRadius: 12,
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  noImageText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 20,
    backgroundColor: 'rgba(37, 37, 68, 1)',
    gap: 5,
  },
  deleteButton: {
    padding: 8,
  },
  deleteIcon: {
    width: 24,
    height: 24,
  },
  destinationsContainer: {
    //flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(153, 153, 153, 1)',
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 5,
    marginHorizontal: 'auto',
    gap: 3,
  },
  resendButton: {
    padding: 8,
  },
  resendIcon: {
    width: 24,
    height: 24,
  },
  // Zoom Modal Styles
  zoomModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '300',
  },
  zoomScrollView: {
    flex: 1,
    width: '100%',
  },
  zoomScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HistoryDetailScreen;
