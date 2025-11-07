import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ScrollView,
  TextInput,
  Linking,
  AppState,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Layout, Text, HistoryCard } from '../components';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../store/hooks';
import sendFilesApiService from '../store/api/sendFilesApi';
import { saveDropboxToken, saveOneDriveToken } from '../store/settingsSlice';
import { updateHistoryDestination, deleteMultipleHistoryEntries } from '../utils/historyUtils';
import { setHistory } from '../store/appSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HistoryScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [selectedSort, setSelectedSort] = useState('Newest scan');
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [selectAnimation] = useState(new Animated.Value(0));
  const [isGridView, setIsGridView] = useState(false);
  const [isOverlayMode, setIsOverlayMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [isBulkResending, setIsBulkResending] = useState(false);

  const history = useSelector((state: any) => state.app.history);
      const destinations = useSelector((state: any) => state.app.destinations);
    const user = useSelector((state: any) => state.app.user);
    const settings = useSelector((state: any) => state.app.settings);
    const dispatch = useAppDispatch();
  const [historyData, setHistoryData] = useState(history);

  useEffect(() => {
    // Filter history based on search text
    const filtered = history.filter((item: any) =>
      searchText !== ''
        ? item.files?.find((file: any) =>
            file.filename.toLowerCase().includes(searchText.toLowerCase()),
          )
        : true,
    );
    setHistoryData(filtered);
  }, [history, searchText]);

  const sortOptions = ['Newest scan', 'Oldest scan', 'Alphabetical order'];

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const toggleSelect = () => {
    const toValue = isSelectOpen ? 0 : 1;
    setIsSelectOpen(!isSelectOpen);

    Animated.timing(selectAnimation, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const selectOption = (option: string) => {
    setSelectedSort(option);
    toggleSelect();
  };

  const toggleCardSelection = (cardId: string | number) => {
    const cardIdStr = String(cardId);
    setSelectedCards(prev =>
      prev.includes(cardIdStr)
        ? prev.filter(id => id !== cardIdStr)
        : [...prev, cardIdStr],
    );
  };

  const selectAllCards = () => {
    setSelectedCards(historyData.map((item: any) => item.timestamp.toString()));
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedCards([]);
  };

  const removeSelectedHistories = async () => {
    const getAllHistories = selectedCards
      .map((cardId: string) => {
        const historyItem = history.find(
          (item: any) => item.timestamp.toString() === cardId,
        );
        if (!historyItem) {
          console.warn(`⚠️ History item not found for timestamp: ${cardId}`);
          return null;
        }
        return historyItem;
      })
      .filter(Boolean);

    if (getAllHistories.length === 0) {
      Alert.alert('Error', 'No items selected for deletion');
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Delete Items',
      `Are you sure you want to delete ${getAllHistories.length} item(s)? This will permanently remove the files from your device.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`🗑️ Starting deletion of ${getAllHistories.length} items...`);
              
              // Use the utility function to delete multiple entries
              const result = await deleteMultipleHistoryEntries(
                getAllHistories,
                history,
                dispatch
              );
              
              // Exit selection mode
              setIsSelectionMode(false);
              setSelectedCards([]);
              
              // Show success message
              if (result.failureCount === 0) {
                Alert.alert(
                  'Success', 
                  `Successfully deleted ${result.successCount} item(s).`
                );
              } else {
                Alert.alert(
                  'Partial Success', 
                  `Deleted ${result.successCount} item(s). ${result.failureCount} item(s) failed to delete.`
                );
              }
              
            } catch (error) {
              console.error('❌ Error during bulk deletion:', error);
              Alert.alert('Error', 'Failed to delete some items. Please try again.');
            }
          },
        },
      ]
    );
  };  
  
  const mergeSelectedHistories = async () => {
    const getAllHistories = selectedCards
      .map((cardId: string) => {
        const historyItem = history.find(
          (item: any) => item.timestamp.toString() === cardId,
        );
        if (!historyItem) {
          console.warn(`⚠️ History item not found for timestamp: ${cardId}`);
          return null;
        }
        return historyItem;
      })
      .filter(Boolean);

    if (getAllHistories.length === 0) {
      Alert.alert('Error', 'No items selected for merging');
      return;
    }

    if (getAllHistories.length === 1) {
      Alert.alert('Info', 'Please select 2 or more items to merge');
      return;
    }

    try {
      console.log(`🔗 Starting merge of ${getAllHistories.length} history items...`);

      // Collect all files from selected histories
      const allFiles: any[] = [];
      getAllHistories.forEach((historyItem: any) => {
        if (historyItem.files && historyItem.files.length > 0) {
          allFiles.push(...historyItem.files);
        }
      });

      console.log(`📁 Collected ${allFiles.length} files for merging`);

      if (allFiles.length === 0) {
        Alert.alert('Error', 'No files found to merge');
        return;
      }

      // Create new merged history entry
      const firstHistory = getAllHistories[0];
      const mergedHistory = {
        id: Date.now().toString(), // New unique ID
        timestamp: Date.now(), // Current timestamp
        destination: firstHistory.destination, // Use first item's destination
        destinationId: firstHistory.destinationId, // Use first item's destination ID
        files: allFiles, // All files from selected histories
        // Keep other properties from first history if needed
        fileName: `Merged_${allFiles.length}_files`, // New file name
      };

      console.log('🆕 Created merged history:', {
        id: mergedHistory.id,
        fileCount: allFiles.length,
        destination: mergedHistory.destination,
        timestamp: new Date(mergedHistory.timestamp).toISOString()
      });

      // Remove selected histories from current history array (but NOT from AsyncStorage)
      const selectedTimestamps = getAllHistories.map(item => item.timestamp);
      const updatedHistory = history.filter((item: any) => 
        !selectedTimestamps.includes(item.timestamp)
      );

      // Add the new merged history
      const finalHistory = [...updatedHistory, mergedHistory];

      console.log(`📝 Updated history: removed ${selectedTimestamps.length} items, added 1 merged item`);

      // Update Redux state
      dispatch(setHistory(finalHistory));

      // Update AsyncStorage with the new history
      await AsyncStorage.setItem('history', JSON.stringify(finalHistory));

      console.log('✅ Merge completed successfully');

      // Exit selection mode
      setIsSelectionMode(false);
      setSelectedCards([]);

      Alert.alert(
        'Merge Complete', 
        `Successfully merged ${getAllHistories.length} items into 1 history entry with ${allFiles.length} files.`
      );

    } catch (error) {
      console.error('❌ Error during merge operation:', error);
      Alert.alert('Error', 'Failed to merge items. Please try again.');
    }
  };

  const deleteAllHistory = async () => {
    try {
      console.log(`🗑️ Starting deletion of all ${history.length} history items...`);
      
      if (history.length === 0) {
        Alert.alert('Info', 'No history items to delete');
        return;
      }

      // Use the existing utility function to delete all history entries
      const result = await deleteMultipleHistoryEntries(
        history, // Pass all history entries
        history, // Current history array
        dispatch // Redux dispatch
      );

      // Show success message
      if (result.failureCount === 0) {
        Alert.alert(
          'Success', 
          `Successfully deleted all ${result.successCount} history items and their files.`
        );
      } else {
        Alert.alert(
          'Partial Success', 
          `Deleted ${result.successCount} history items successfully. ${result.failureCount} items failed to delete.`
        );
      }

    } catch (error) {
      console.error('❌ Critical error during delete all operation:', error);
      Alert.alert('Error', 'Failed to delete all history items. Please try again.');
    }
  };

  const shareSelectedHistories = async () => {
    const getAllHistories = selectedCards
      .map((cardId: string) => {
        const historyItem = history.find(
          (item: any) => item.timestamp.toString() === cardId,
        );
        if (!historyItem) {
          console.warn(`⚠️ History item not found for timestamp: ${cardId}`);
          return null;
        }
        return historyItem;
      })
      .filter(Boolean);

    if (getAllHistories.length === 0) {
      Alert.alert('Error', 'No items selected for sharing');
      return;
    }

    try {
      // Collect all files from selected histories
      const allFiles: string[] = [];
      let fileCount = 0;

      getAllHistories.forEach((historyItem: any) => {
        if (historyItem.files && historyItem.files.length > 0) {
          historyItem.files.forEach((file: any) => {
            const filePath = file.url.startsWith('file://') ? file.url : `file://${file.url}`;
            allFiles.push(filePath);
            fileCount++;
          });
        }
      });

      console.log(`📤 Sharing ${fileCount} files from ${getAllHistories.length} history entries...`);

      if (allFiles.length === 0) {
        Alert.alert('Error', 'No files found to share');
        return;
      }

      // Share files (React Native Share only supports one URL at a time)
      if (allFiles.length === 1) {
        // Single file sharing
        await Share.share({
          url: allFiles[0],
          message: `Sharing scanned BERRĪ document`,
        });
      } else {
        // Multiple files - share them one by one or show selection
        Alert.alert(
          'Share Multiple Files',
          `You have selected ${fileCount} files. How would you like to share them?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Share First File',
              onPress: async () => {
                await Share.share({
                  url: allFiles[0],
                  message: `Sharing first of ${fileCount} scanned BERRĪ documents`,
                });
              },
            },
            {
              text: 'Share All Individually',
              onPress: async () => {
                for (let i = 0; i < allFiles.length; i++) {
                  await Share.share({
                    url: allFiles[i],
                    message: `Sharing scanned BERRĪ document (${i + 1}/${fileCount})`,
                  });
                  // Small delay between shares
                  await new Promise<void>(resolve => setTimeout(resolve, 500));
                }
              },
            },
          ]
        );
        return; // Don't exit selection mode yet for multiple files
      }

      console.log('✅ Files shared successfully');

      // Exit selection mode after sharing
      setIsSelectionMode(false);
      setSelectedCards([]);

    } catch (error) {
      console.error('❌ Error sharing files:', error);
      Alert.alert('Error', 'Failed to share files. Please try again.');
    }
  };

    // Resume bulk resend operation with fresh OAuth tokens
  const resumeBulkResendWithFreshTokens = useCallback(async (
    service: 'dropbox' | 'onedrive',
    freshSettings: any
  ) => {
    console.log(`🔄 Resuming bulk resend with fresh ${service} tokens...`);
    
    try {
      // Get the current state of bulk operation
      const currentHistories = selectedCards.map(cardId => 
        history.find((item: any) => item.id === cardId)
      ).filter(Boolean);

      // Filter to only histories that need this specific service
      const pendingHistories = currentHistories.filter(historyItem => {
        const destination = destinations.find((d: any) => d.id === historyItem?.destinationId);
        return destination?.service === service;
      });

      console.log(`📋 Resuming ${pendingHistories.length} pending ${service} operations...`);

      // Process each pending history item SEQUENTIALLY
      for (let i = 0; i < pendingHistories.length; i++) {
        const historyItem = pendingHistories[i];
        if (!historyItem) continue;

        try {
          console.log(`📤 [${i + 1}/${pendingHistories.length}] Resending ${historyItem.fileName} to ${service}...`);
          
          const destination = destinations.find((d: any) => d.id === historyItem.destinationId);
          if (!destination) {
            console.warn(`⚠️ Destination not found for history item ${historyItem.id}`);
            continue;
          }

          // Wait for each upload to complete before moving to next
          await sendFilesApiService.resendToDestination(
            destination.id,
            destinations,
            historyItem,
            user,
            freshSettings,
            dispatch
          );

          console.log(`✅ [${i + 1}/${pendingHistories.length}] Successfully resent ${historyItem.fileName}`);
          
          // Update history entry with fresh timestamp
          await updateHistoryDestination(
            historyItem,
            destination.id,
            history,
            dispatch
          );
        } catch (error) {
          console.error(`❌ [${i + 1}/${pendingHistories.length}] Error resending ${historyItem.fileName}:`, error);
          // Continue with next item even if this one fails
        }
      }

      console.log(`✅ Completed bulk resend resume for ${service}`);
      
      // Turn off loading state
      setIsBulkResending(false);

    } catch (error) {
      console.error(`❌ Critical error during bulk resend resume for ${service}:`, error);
      setIsBulkResending(false);
    }
  }, [selectedCards, history, destinations, user, dispatch, setIsBulkResending]);

    const resendSelectedHistories = async () => {
    console.log('� Starting bulk resend operation...');
    
    // Show loading state
    setIsBulkResending(true);
    
    try {

      console.log("history:", history);
      console.log("selectedCards:", selectedCards);
      // Convert selectedCards timestamps to actual history entries
      const getAllHistories = selectedCards
        .map((cardId: string) => {
          const historyItem = history.find(
            (item: any) => item.timestamp.toString() === cardId,
          );
          if (!historyItem) {
            console.warn(`⚠️ History item not found for timestamp: ${cardId}`);
            return null;
          }
          return historyItem;
        })
        .filter(Boolean);

      if (getAllHistories.length === 0) {
        console.warn('⚠️ No valid history items to resend');
        setIsBulkResending(false);
        Alert.alert('Error', 'No valid items selected for resend');
        return;
      }

      console.log('📋 Filtered histories to resend:', getAllHistories.length);

      // Group histories by destination for efficient processing
      const destinationGroups: { [key: number]: any[] } = {};
      getAllHistories.forEach((historyItem: any) => {
        const destType = historyItem.destination;
        if (!destinationGroups[destType]) {
          destinationGroups[destType] = [];
        }
        destinationGroups[destType].push(historyItem);
      });

      console.log('📊 Destination groups:', Object.keys(destinationGroups).map(key => 
        `Dest ${key}: ${destinationGroups[parseInt(key, 10)].length} items`
      ));

      let successCount = 0;
      let failureCount = 0;

      // Process each destination group SEQUENTIALLY
      for (const [destType, histories] of Object.entries(destinationGroups)) {
        console.log(`🎯 Processing destination ${destType} with ${histories.length} histories...`);
        
        // Get destination configuration
        const destinationConfig = destinations.find((dest: any) => dest.type === parseInt(destType, 10));
        const serviceType = destinationConfig?.destination || 'email';

        // Process each history item SEQUENTIALLY within the group
        for (let i = 0; i < histories.length; i++) {
          const historyItem = histories[i];
          
          try {
            console.log(`📤 [${i + 1}/${histories.length}] Processing ${historyItem.files[0]?.filename} to ${serviceType}...`);
            
            // Wait for each upload to complete before moving to next
            await sendFilesApiService.resendToDestination(
              parseInt(destType, 10),
              destinations,
              historyItem,
              user,
              settings,
              dispatch
            );

            console.log(`✅ [${i + 1}/${histories.length}] Successfully resent ${historyItem.files[0]?.filename}`);
            successCount++;
            
          } catch (error) {
            console.error(`❌ [${i + 1}/${histories.length}] Error resending ${historyItem.files[0]?.filename}:`, error);
            failureCount++;
            
            // Check if it's an OAuth error that requires re-authentication
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage?.includes('refresh_token') || errorMessage?.includes('unauthorized') || errorMessage?.includes('token')) {
              console.log(`🔐 OAuth error detected for ${serviceType}, stopping bulk operation...`);
              setIsBulkResending(false);
              
              // Let the OAuth flow handle the re-authentication
              // The resume will be called from the token exchange functions
              return;
            }
            
            // For other errors, continue with next item
            continue;
          }
        }
      }

      // All done successfully
      setIsBulkResending(false);
      
      Alert.alert(
        'Bulk Resend Complete', 
        `Successfully resent ${successCount} files.${failureCount > 0 ? ` ${failureCount} failed.` : ''}`,
        [{
          text: 'OK',
          onPress: () => {
            setIsSelectionMode(false);
            setSelectedCards([]);
          },
        }]
      );

    } catch (error) {
      console.error('❌ Critical error during bulk resend:', error);
      setIsBulkResending(false);
      Alert.alert('Error', 'Failed to complete bulk resend operation. Please try again.');
    }
  };

  // Tab bar elrejtése/megjelenítése selection mode-ban
  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: isSelectionMode
        ? { display: 'none' }
        : {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderTopWidth: 0,
            zIndex: 1,
            elevation: 1,
          },
    });
  }, [isSelectionMode, navigation]);

  // custom stuff on top of tabbar
  // https://stackoverflow.com/questions/63108520/how-to-add-components-above-creatematerialtoptabnavigator


  // handle deeplink if user has to log in again
  // Dropbox OAuth configuration

  const clientId = 'stli417u8q7kp0a';

  // OneDrive OAuth configuration
  const oneDriveRedirectUri = 'berri://onedrive-auth';
  const oneDriveClientId = '05a68d6c-e3f6-497b-9fd5-0e54cf3c3be9';

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
              // Continue sending files with fresh Dropbox tokens
              console.log('🔄 Resuming bulk resend with fresh Dropbox tokens...');
              await resumeBulkResendWithFreshTokens('dropbox', updatedSettings);
              
              Alert.alert('Success', 'Files have been resent successfully!', [
                {
                  text: 'OK',
                  onPress: () => {
                    // Exit selection mode
                    setIsSelectionMode(false);
                    setSelectedCards([]);
                  },
                },
              ]);
            } catch (error) {
              console.error('❌ Error resuming bulk resend:', error);
              Alert.alert('Error', 'Failed to resume sending files. Please try again.');
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
    [clientId, dispatch, resumeBulkResendWithFreshTokens, settings],
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

            // Continue sending files with fresh OneDrive tokens
            try {
              console.log('🔄 Resuming bulk resend with fresh OneDrive tokens...');
              await resumeBulkResendWithFreshTokens('onedrive', updatedSettings);
              
              Alert.alert('Success', 'Files have been resent successfully!', [
                {
                  text: 'OK',
                  onPress: () => {
                    // Exit selection mode
                    setIsSelectionMode(false);
                    setSelectedCards([]);
                  },
                },
              ]);
            } catch (error) {
              console.error('❌ Error resuming bulk resend:', error);
              Alert.alert('Error', 'Failed to resume sending files. Please try again.');
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
    [oneDriveClientId, dispatch, resumeBulkResendWithFreshTokens, settings],
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
    <View style={styles.screenWrapper}>
      {/* Loading Overlay for Bulk Resend */}
      {isBulkResending && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Sending files...</Text>
            <Text style={styles.loadingSubtext}>Please wait while we process your files</Text>
          </View>
        </View>
      )}
      
      <Layout
        type="default"
        headerTitle="History"
        onMenuPress={openDrawer}
        rightComponent={
          <TouchableOpacity
            onPress={() => setIsOverlayMode(true)}
            style={styles.dotsButton}
          >
            <Image
              resizeMode="contain"
              source={require('../assets/dots.png')}
              style={styles.dotsIcon}
            />
          </TouchableOpacity>
        }
      >
        {isSelectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity
              onPress={cancelSelection}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.selectedCountText}>
              {selectedCards.length} selected
            </Text>
            <TouchableOpacity
              onPress={selectAllCards}
              style={styles.selectButton}
            >
              <Text style={styles.selectAllText}>Select All</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.container}>
          {/* Search Input */}
          <View
            style={[
              styles.searchContainer,
              isSelectionMode && styles.searchContainerWithSelection,
            ]}
          >
            <View style={styles.searchInputContainer}>
              <Image
                source={require('../assets/search.png')}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={'white'}
                value={searchText}
                onChangeText={text => {
                  setSearchText(text);
                  if (text !== '') {
                    console.log('ITEM HISTORY FILTERED', history);
                    setHistoryData(
                      history.filter((item: any) =>
                        item.files.find((file: any) =>
                          file.filename
                            .toLowerCase()
                            .includes(searchText.toLowerCase()),
                        ),
                      ),
                    );
                  } else {
                    setHistoryData(history);
                  }
                }}
              />
            </View>
          </View>

          {/* Custom Select and Reorder */}
          <View style={styles.selectAndReorderContainer}>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={toggleSelect}
            >
              <Text style={styles.selectText}>{selectedSort}</Text>
              <Image
                style={styles.dropdownArrow}
                resizeMode="contain"
                source={require('../assets/arrow-down.png')}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reorderButton}
              onPress={() => setIsGridView(!isGridView)}
            >
              <Image
                source={require('../assets/arrange.png')}
                style={styles.reorderIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          {/* Content area that will be covered by overlay */}
          <View style={styles.contentWrapper}>
            {/* Select Overlay */}
            {isSelectOpen && (
              <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={toggleSelect}
              >
                <Animated.View
                  style={[
                    styles.selectOptions,
                    {
                      opacity: selectAnimation,
                      transform: [
                        {
                          translateY: selectAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-10, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.sortByLabel}>Sort by</Text>
                  {sortOptions.map(option => (
                    <TouchableOpacity
                      key={option}
                      style={styles.selectOption}
                      onPress={() => selectOption(option)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedSort === option && styles.selectedOptionText,
                        ]}
                      >
                        {option}
                      </Text>
                      {selectedSort === option && (
                        <Image
                          source={require('../assets/checkmark.png')}
                          style={styles.checkmarkIcon}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              </TouchableOpacity>
            )}

            <View style={styles.content}>
              {historyData.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No scan history yet</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.historyList}
                  showsVerticalScrollIndicator={false}
                >
                  {isGridView ? (
                    <View style={styles.gridContainer}>
                      {[...historyData]
                        ?.sort((a: any, b: any) => {
                          switch (selectedSort) {
                            case 'Newest scan':
                              return b.timestamp - a.timestamp; // Newest first
                            case 'Oldest scan':
                              return a.timestamp - b.timestamp; // Oldest first
                            case 'Alphabetical order':
                              const filenameA =
                                a.files?.[0]?.filename?.toLowerCase() || '';
                              const filenameB =
                                b.files?.[0]?.filename?.toLowerCase() || '';
                              return filenameA.localeCompare(filenameB);
                            default:
                              return b.timestamp - a.timestamp; // Default to newest
                          }
                        })
                        .map((historyItem: any) => (
                          <HistoryCard
                            key={historyItem.id || historyItem.timestamp}
                            history={historyItem}
                            isGridView={isGridView}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedCards.includes(
                              historyItem.timestamp.toString(),
                            )}
                            onToggleSelection={toggleCardSelection}
                          />
                        ))}
                    </View>
                  ) : (
                    [...historyData]
                      ?.sort((a: any, b: any) => {
                        switch (selectedSort) {
                          case 'Newest scan':
                            return b.timestamp - a.timestamp; // Newest first
                          case 'Oldest scan':
                            return a.timestamp - b.timestamp; // Oldest first
                          case 'Alphabetical order':
                            const filenameA =
                              a.files?.[0]?.filename?.toLowerCase() || '';
                            const filenameB =
                              b.files?.[0]?.filename?.toLowerCase() || '';
                            return filenameA.localeCompare(filenameB);
                          default:
                            return b.timestamp - a.timestamp; // Default to newest
                        }
                      })
                      .map((historyItem: any) => (
                        <HistoryCard
                          key={historyItem.id || historyItem.timestamp}
                          history={historyItem}
                          isGridView={isGridView}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedCards.includes(
                            historyItem.timestamp.toString(),
                          )}
                          onToggleSelection={toggleCardSelection}
                        />
                      ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>

          {/* Selection Mode Bottom Bar */}
          {isSelectionMode && (
            <View style={styles.selectionBottomBar}>
              <TouchableOpacity style={styles.bottomButton} onPress={() => removeSelectedHistories()}>
                <Image
                  source={require('../assets/trash.png')}
                  style={styles.bottomButtonIcon}
                  resizeMode='contain'
                />
                <Text style={styles.bottomButtonText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bottomButton} onPress={() => mergeSelectedHistories()}>
                <Image
                  source={require('../assets/merge.png')}
                  style={styles.bottomButtonIcon}
                  resizeMode='contain'
                />
                <Text style={styles.bottomButtonText}>Merge</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bottomButton} onPress={() => resendSelectedHistories()}>
                <Image
                  source={require('../assets/resend.png')}
                  style={styles.bottomButtonIcon}
                  resizeMode='contain'
                />
                <Text style={styles.bottomButtonText}>Resend</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bottomButton} onPress={() => shareSelectedHistories()}>
                <Image
                  source={require('../assets/share.png')}
                  style={styles.bottomButtonIcon}
                  resizeMode='contain'
                />
                <Text style={styles.bottomButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Overlay Mode */}
          {isOverlayMode && (
            <View style={styles.overlayMode}>
              <TouchableOpacity
                style={styles.overlayBackground}
                onPress={() => setIsOverlayMode(false)}
              />
              <View style={styles.overlayButtons}>
                <TouchableOpacity
                  style={styles.overlayButton}
                  onPress={() => {
                    setIsOverlayMode(false);
                    setIsSelectionMode(true);
                  }}
                >
                  <Image
                    resizeMode="contain"
                    source={require('../assets/select.png')}
                    style={styles.overlayButtonIcon}
                  />
                  <Text style={styles.overlayButtonText}>Select</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.overlayButton}
                  onPress={() => {
                    setIsOverlayMode(false);
                    setShowDeleteConfirm(true);
                  }}
                >
                  <Image
                    resizeMode="contain"
                    source={require('../assets/trash.png')}
                    style={styles.overlayButtonIcon}
                  />
                  <Text style={styles.overlayButtonText}>Delete All</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <View style={styles.confirmationOverlay}>
              <TouchableOpacity
                style={styles.overlayBackground}
                onPress={() => setShowDeleteConfirm(false)}
              />
              <View style={styles.confirmationDialog}>
                <Text style={styles.confirmationText}>
                  Are you sure you want to delete all history items?
                </Text>
                <View style={styles.confirmationButtons}>
                  <TouchableOpacity
                    style={[styles.confirmationButton, styles.cancelButton]}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={styles.cancelButtonText}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmationButton, styles.deleteButton]}
                    onPress={async () => {
                      setShowDeleteConfirm(false);
                      await deleteAllHistory();
                    }}
                  >
                    <Text style={styles.deleteButtonText}>Yes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Layout>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    zIndex: 9999999,
    elevation: 9999999,
  },
  container: {
    flex: 1,
  },
  dotsButton: {
    padding: 8,
    marginTop: 'auto',
  },
  dotsIcon: {
    width: 24,
    height: 24,
    tintColor: 'white',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dropdownArrow: {
    marginLeft: 10,
    width: 12,
    height: 12,
    alignSelf: 'center',
  },
  searchContainerWithSelection: {
    paddingTop: 120, // Make room for selection header
  },
  searchInputContainer: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#252544D9', // 85% opacity
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 4,
    gap: 10,
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: 'white',
  },
  searchInput: {
    color: 'white',
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  selectContainer: {
    paddingHorizontal: 20,
    paddingBottom: 6, // Reduced padding
  },
  selectAndReorderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  selectButton: {
    paddingVertical: 8,
    flex: 1,
    flexDirection: 'row',
  },
  reorderButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  reorderIcon: {
    width: 20,
    height: 14,
    tintColor: 'white',
  },
  selectText: {
    fontSize: 16,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0, // Start from top of contentWrapper, not full screen
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(37, 37, 68, 0.86)',
    zIndex: 1000,
    paddingTop: 20, // Small margin from select
    paddingHorizontal: 20,
  },
  selectOptions: {
    //backgroundColor: '#252544',
    // borderRadius: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    // borderWidth: 1,
    // borderColor: 'white',
    alignSelf: 'flex-start',
  },
  sortByLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  optionText: {
    fontSize: 16,
  },
  selectedOptionText: {
    color: '#F3CCFBEB',
  },
  checkmarkIcon: {
    width: 16,
    height: 16,
    tintColor: '#F3CCFBEB',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyList: {
    flex: 1,
    width: '100%',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  // Overlay Mode Styles
  overlayMode: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(37, 37, 68, 0.86)',
  },
  overlayButtons: {
    position: 'absolute',
    backgroundColor: 'rgba(37, 37, 68, 1)',
    paddingVertical: 30,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overlayButton: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 25,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  overlayButtonIcon: {
    width: 24,
    height: 24,
    marginRight: 5,
  },
  overlayButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '400',
  },
  // Confirmation Dialog Styles
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationDialog: {
    backgroundColor: '#252544',
    margin: 40,
    borderRadius: 15,
    padding: 25,
    borderWidth: 1,
    borderColor: 'white',
  },
  confirmationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  confirmationButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    minWidth: 80,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Selection Mode Styles
  selectionHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#252544',
    zIndex: 1000,
    elevation: 1000,
  },
  cancelText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedCountText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectAllText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  // Selection Bottom Bar Styles
  selectionBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#252544',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  selectionBottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bottomButton: {
    alignItems: 'center',
    flex: 1,
  },
  bottomButtonIcon: {
    width: 24,
    height: 24,
    tintColor: 'white',
    marginBottom: 6,
  },
  bottomButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  loadingContainer: {
    backgroundColor: 'rgba(37, 37, 68, 0.95)',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HistoryScreen;
