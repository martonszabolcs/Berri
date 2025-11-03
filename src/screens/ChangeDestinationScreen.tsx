import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ScrollView, Linking, AppState } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Layout, Button, Text } from '../components';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { saveDropboxToken } from '../store/settingsSlice';

type RootStackParamList = {
  ChangeDestinationScreen: { 
    destination?: any;
    access_token?: string;
    token_type?: string;
  };
};

type ChangeDestinationScreenRouteProp = RouteProp<RootStackParamList, 'ChangeDestinationScreen'>;

type DestinationType = 'Google Drive' | 'Dropbox' | 'OneDrive' | 'Email';

const ChangeDestinationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ChangeDestinationScreenRouteProp>();
  const { destination, access_token, token_type } = route.params || {};
  const destinationId = destination?.type?.toString() || '1';
  const user = useAppSelector((state) => state.app.user);
  const dispatch = useAppDispatch();
  const [selectedDestination, setSelectedDestination] = useState<DestinationType>('Email');
  const [codeVerifier, setCodeVerifier] = useState<string | null>(null);

  // Dropbox OAuth configuration
  const redirectUri = 'berri://dropbox-auth';
  const clientId = 'stli417u8q7kp0a';

  // PKCE utility functions
  const generateCodeVerifier = () => {
    // Generate a random string of 43-128 characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < 128; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateCodeChallenge = async (verifier: string) => {
    // For React Native, we'll use plain method for simplicity
    // In production, you should use SHA256 hashing
    return verifier; // Using code_challenge_method=plain
  };

  // Exchange authorization code for access token
  const exchangeCodeForToken = useCallback(async (authCode: string, verifier: string) => {
    try {
      const tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
      
      const body = new URLSearchParams({
        code: authCode,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });

      console.log('📤 Token exchange request:', {
        url: tokenUrl,
        code: authCode.substring(0, 20) + '...',
        verifier: verifier.substring(0, 20) + '...',
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
        console.log("DATA", data);
        console.log('🎉 Access token received:', data.access_token?.substring(0, 20) + '...');
        console.log('🎉 Refresh token received:', data.refresh_token?.substring(0, 20) + '...');
        
        // Save the Dropbox tokens to backend via Redux
        try {
          const tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token
          };
          
          await dispatch(saveDropboxToken(tokens)).unwrap();
          console.log('✅ Dropbox tokens saved to backend successfully!');
          
          // Clear the code verifier
          setCodeVerifier(null);
          
          // Navigate back with success
          navigation.goBack();
        } catch (error) {
          console.error('❌ Failed to save Dropbox tokens:', error);
          // Handle error - maybe show a toast or alert
        }
      } else {
        console.error('❌ Token exchange failed:', data);
      }
    } catch (error) {
      console.error('❌ Error during token exchange:', error);
    }
  }, [clientId, redirectUri, dispatch, navigation]);

  // Check for Dropbox token from React Navigation linking
  useEffect(() => {
    console.log('🎯 Route params:', { destination, access_token, token_type });
    
    if (access_token) {
      console.log('🎉 REACT NAVIGATION: Dropbox access token received!', access_token);
      
      // Save the token here
      // dispatch(saveDropboxToken(access_token));
      
      // Show success message or navigate back
      console.log('✅ Dropbox connected via React Navigation!');
    }
  }, [access_token, token_type, destination]);

  const getDestinationName = (dest: any) => {
    if (dest?.destination && dest.destination !== 'email') {
      return dest.destination.charAt(0).toUpperCase() + dest.destination.slice(1);
    }
    return getFruitName(dest?.type?.toString() || '1');
  };

  const getFruitName = (type: string) => {
    switch (type) {
      case '1': return 'Cherry';
      case '2': return 'Ananas'; 
      case '3': return 'Apple';
      case '4': return 'Banana';
      case '5': return 'Orange';
      case '6': return 'Melone';
      case '7': return 'Grapes';
      default: return 'Unknown Fruit';
    }
  };

  // Set initial selected destination based on current destination
  useEffect(() => {
    if (destination?.destination) {
      switch (destination.destination.toLowerCase()) {
        case 'dropbox':
          setSelectedDestination('Dropbox');
          break;
        case 'google_drive':
        case 'googledrive':
          setSelectedDestination('Google Drive');
          break;
        case 'onedrive':
          setSelectedDestination('OneDrive');
          break;
        default:
          setSelectedDestination('Email');
      }
    }
  }, [destination?.destination]);

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

  const destinations: DestinationType[] = ['Google Drive', 'Dropbox', 'OneDrive', 'Email'];

  const handleDestinationSelect = (destinationType: DestinationType) => {
    setSelectedDestination(destinationType);
  };

  const handleSave = () => {
    console.log('Saving destination:', selectedDestination);
    if (selectedDestination === 'Email') {
      // Logic to set destination to email
    } else if (selectedDestination === 'Google Drive') {
      // Logic to set destination to selected cloud service
    } else if (selectedDestination === 'Dropbox') {
      connectToDropbox();
    } else if (selectedDestination === 'OneDrive') {
      // Logic to set destination to selected cloud service
    }
  }

  const connectToDropbox = async () => {
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      setCodeVerifier(verifier);

      const url = `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&token_access_type=offline&code_challenge=${challenge}&code_challenge_method=plain`;
      
      const result = await Linking.openURL(url);
      console.log('🎯 Linking.openURL result:', result);
    } catch (error) {
      console.error('❌ Error connecting to Dropbox:', error);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  useEffect(() => {
    console.log('🎯 ChangeDestinationScreen mounted - setting up AppState + URL listeners');
    
    const handleURL = (url: string) => {
      console.log('📱 URL received:', url);
      
      if (url.includes('dropbox-auth')) {
        console.log('🎉 Dropbox URL detected!', url);
                const codeMatch = url.match(/code=([^&]+)/);
        if (codeMatch && codeVerifier) {
          const authCode = codeMatch[1];
          
          exchangeCodeForToken(authCode, codeVerifier);
        } else if (codeMatch && !codeVerifier) {
          console.error('❌ Code verifier not found! Cannot exchange code for token.');
        }
      }
    };

    const handleAppStateChange = (nextAppState: string) => {
      
      if (nextAppState === 'active') {
        setTimeout(() => {
          Linking.getInitialURL().then((url) => {
            console.log('🔍 getInitialURL after app became active:', url);
            if (url) {
              handleURL(url);
            }
          });
        }, 100);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔍 Initial URL on mount:', url);
        handleURL(url);
      }
    });

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleURL(url);
    });

    console.log('✅ All listeners set up successfully');

    return () => {
      console.log('🧹 Cleaning up AppState and URL listeners');
      appStateSubscription.remove();
      urlSubscription.remove();
    };
  }, [codeVerifier, dispatch, exchangeCodeForToken]); // Added all dependencies 

  return (
    <Layout type="dark" headerTitle={`Change ${getDestinationName(destination)} Destination`}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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

        <View style={styles.optionsContainer}>
          {destinations.map((destinationType) => (
            <TouchableOpacity
              key={destinationType}
              style={[
                styles.destinationOption,
                selectedDestination === destinationType && styles.destinationOptionActive
              ]}
              onPress={() => handleDestinationSelect(destinationType)}
            >
              <Text style={[
                styles.destinationOptionText,
                selectedDestination === destinationType && styles.destinationOptionTextActive
              ]}>
                {destinationType}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.buttonContainer}>
           <Button
            title="Save"
            size="large"
            onPress={handleSave}
          />
          <Button
            title="Cancel"
            variant="outline"
            size="large"
            onPress={handleCancel}
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
    marginBottom: 40,
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
  optionsContainer: {
    gap: 15,
    marginBottom: 40,
  },
  destinationOption: {
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  destinationOptionActive: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  destinationOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  destinationOptionTextActive: {
    color: 'black',
  },
  buttonContainer: {
    paddingBottom: 100, // Extra space for tab bar
  },
});

export default ChangeDestinationScreen;