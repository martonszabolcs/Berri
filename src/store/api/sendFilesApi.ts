import axios from 'axios';
import {
  API_CONFIG,
  DROPBOX_CLIENT,
  DROPBOX_SECRET,
  ONEDRIVE_CLIENT,
} from '../../config';
import { getStore } from '../storeRef';
import { Dirs, FileSystem } from 'react-native-file-access';
import { Buffer } from 'buffer';
import { Linking, Platform } from 'react-native';
import {
  saveDropboxToken,
  saveOneDriveToken,
  saveGoogleDriveToken,
} from '../settingsSlice';
import { refreshUser } from '../appSlice';
import { uploadAndSendFile } from '../uploadSlice';
import RNFS from 'react-native-fs';
import { PDFDocument, rgb } from 'pdf-lib';
import ImageResizer from 'react-native-image-resizer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PDF_EXPORT_WIDTH = 1500;
const PDF_EXPORT_HEIGHT = 2250;
const PDF_EXPORT_JPEG_QUALITY = 85;

// Helper to build full file path from filename or url
const getFullFilePath = (urlOrFilename: string): string => {
  // If it's already a full path (contains /), use it as-is
  if (urlOrFilename.includes('/')) {
    return urlOrFilename.replace('file://', '');
  }
  // Otherwise, it's just a filename - build full path from Documents dir
  return `${Dirs.DocumentDir}/${urlOrFilename}`;
};

class SendFilesApiService {
  private codeVerifier: string | null = null;

  setCodeVerifier = (verifier: string | null) => {
    console.log('SET CODE VERIFIER:', verifier);
    this.codeVerifier = verifier;
  };

  getCodeVerifier = (): string | null => {
    console.log(
      '🔍 Getting code verifier:',
      this.codeVerifier ? this.codeVerifier.substring(0, 10) + '...' : 'null',
    );
    return this.codeVerifier;
  };

  // Clear code verifier after successful token exchange
  clearCodeVerifier = () => {
    console.log('🧹 Clearing code verifier after successful token exchange');
    this.codeVerifier = null;
  };

  // Debug function to check current state
  debugCodeVerifierState = () => {
    console.log('🔍 DEBUG: Current codeVerifier state:', {
      hasVerifier: !!this.codeVerifier,
      verifierPreview: this.codeVerifier
        ? this.codeVerifier.substring(0, 15) + '...'
        : 'null',
      verifierLength: this.codeVerifier?.length || 0,
    });
  };

  generateCodeVerifier = () => {
    // Generate a random string of 43-128 characters
    // FIXED: Removed ~ and . characters to prevent URL encoding issues
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 128; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.log(
      '🔑 Generated code verifier (safe chars only):',
      result.substring(0, 20) + '...',
    );
    return result;
  };

  async generateCodeChallenge(verifier: string) {
    // For React Native, we'll use plain method for simplicity
    // In production, you should use SHA256 hashing
    return verifier; // Using code_challenge_method=plain
  }

  async resendToDestination(
    destinationIds: number[],
    destinations: any,
    history: any,
    user: any,
    settings: any,
    dispatch: any,
  ) {
    console.log(`📤 Resending to destinations ${destinationIds.join(', ')}`);

    const newFileArray = history.files.map((file: any) => ({
      fileName: file.filename,
      filePath: getFullFilePath(file.url || file.filename),
    }));



          // TODO uniq email, dropbox, google drive, onedrive
      let finalSelectedDestinations = []
      for (const selectedDestinationType of destinationIds) {
        console.log(`📤 Processing destination ${selectedDestinationType}...`);

        let destinationConfig = destinations.find(
          (dest: any) => dest.type === selectedDestinationType,
        );

        if (!destinationConfig) {
          console.log(
            `📧 User has no destination of type ${selectedDestinationType}, creating email destination with user email`,
          );

          try {
                      const { updateDestinationSettings } = await import('./userApiService');
            const success = await updateDestinationSettings(
              selectedDestinationType.toString(),
              {
                destination: 'email',
                emails: user.email,
              },
            );

            if (success) {
              console.log('✅ Email destination created successfully');
              // const { refreshUser } = await import('../store/appSlice');
              // await dispatch(refreshUser());
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




    // Send to all destinations from the history entry
    for (const uniqDest of uniqSelectedDestinations) {
      console.log(`📤 Processing resend to destination ${uniqDest.type}...`);

      const selectedDest = uniqDest;

      if (selectedDest.destination === 'email') {
        console.log('📧 Resending via email to:', user.email);
        try {
          await this.uploadToEmail(newFileArray, selectedDest);
          console.log('✅ File resent via email successfully');
        } catch (error) {
          console.error('❌ Error resending via email:', error);
          throw error;
        }
      } else if (selectedDest.destination === 'dropbox') {
        console.log('📤 Resending to Dropbox...');

        try {
          await this.uploadToDropbox(
            settings.dropboxAccessToken,
            settings.dropboxRefreshToken,
            newFileArray,
            selectedDest,
          );
          console.log('✅ File resent to Dropbox successfully');
        } catch (error) {
          console.error('❌ Error resending to Dropbox:', error);
          throw error;
        }
      } else if (selectedDest.destination === 'onedrive') {
        console.log('📤 Resending to OneDrive...');

        try {
          await this.uploadToOneDrive(
            settings.oneDriveAccessToken,
            settings.oneDriveRefreshToken,
            newFileArray,
            selectedDest,
          );
          console.log('✅ File resent to OneDrive successfully');
        } catch (error) {
          console.error('❌ Error resending to OneDrive:', error);
          throw error;
        }
      } else if (selectedDest.destination === 'googledrive') {
        console.log('📤 Resending to Google Drive...');

        try {
          await this.uploadToGoogleDrive(
            settings.googleDriveAccessToken,
            settings.googleDriveRefreshToken,
            newFileArray,
            selectedDest,
          );
          console.log('✅ File resent to Google Drive successfully');
        } catch (error) {
          console.error('❌ Error resending to Google Drive:', error);
          throw error;
        }
      } else {
        console.log(
          `📤 Resending to ${selectedDest.destination} - not implemented yet`,
        );
        throw new Error(`${selectedDest.destination} resend not implemented yet`);
      }
    }

    console.log('✅ All resend destinations processed successfully');
  }

  // EMAIL
  async uploadToEmail(
    imagesProp: Array<{ fileName: string; filePath: string }>,
    destinationConfig: any,
  ) {
    try {
      console.log('📧 Uploading multiple files to email...');
      
      const state = getStore().getState();
      const token = state.app.token;
      if (!token) {
        throw new Error('No auth token found in Redux store');
      }

      const images = await this.getSendFilesArray(imagesProp, destinationConfig);
      console.log(`📎 Preparing to send ${images.length} files via email in one request`);

      // Create FormData for multiple files
      const formData = new FormData();

      // Add all files to the FormData
      for (const image of images) {
        console.log(`� Adding ${image.fileName} to FormData...`);
        
        const fileObject = {
          uri: `file://${image.filePath}`,
          name: image.fileName,
          type: image.fileName.toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : 'image/jpeg',
        };

        // Add each file with 'files' as the field name (array)
        formData.append('files', fileObject as any);
      }

      console.log(`📤 Making request to send ${images.length} files via email:`, `${API_CONFIG.BASE_URL}/destinations/send/${destinationConfig.type}`);

      // Send all files in one request
      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/destinations/send/${destinationConfig.type}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      console.log(`✅ All ${images.length} files sent via email successfully:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error sending multiple files via email:', error);
      
      // Log detailed error information
      if (error.response) {
        console.error('❌ Email API Response status:', error.response.status);
        console.error('❌ Email API Response data:', error.response.data);
      }
      
      throw error;
    }
  }

  // DROPBOX
  // CONNECT (NEEDS DEEPLINK HANDLING )
  private isConnecting = false; // Prevent duplicate calls

  async connectToDropbox() {
    try {
      // Prevent duplicate OAuth calls
      if (this.isConnecting) {
        console.log('⚠️ OAuth already in progress, skipping duplicate call');
        return;
      }

      this.isConnecting = true;

      // Clear any previous code verifier to prevent conflicts
      this.setCodeVerifier(null);
      console.log('🧹 Cleared previous code verifier');

      const verifier = this.generateCodeVerifier();
      const challenge = await this.generateCodeChallenge(verifier);
      const redirectUri = 'berri://dropbox-auth';
      const clientId = DROPBOX_CLIENT;

      // Set the new verifier
      this.setCodeVerifier(verifier);
      console.log(
        '🔑 New code verifier set:',
        verifier.substring(0, 10) + '...',
      );

      // Debug OAuth configuration
      console.log('🔧 OAuth Configuration:', {
        clientId,
        redirectUri,
        codeVerifierLength: verifier.length,
        challengeLength: challenge.length,
        challengeMatchesVerifier: challenge === verifier,
      });

      // DON'T encode redirect_uri - use plain format for consistency
      const url = `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&token_access_type=offline&code_challenge=${challenge}&code_challenge_method=plain`;

      console.log('🌐 Opening Dropbox OAuth URL...');
      console.log('🔗 Full OAuth URL:', url);
      const result = await Linking.openURL(url);
      console.log('🎯 Linking.openURL result:', result);

      // Reset the connecting flag after a delay
      setTimeout(() => {
        this.isConnecting = false;
        console.log('✅ OAuth connection flag reset');
      }, 5000);
    } catch (error) {
      console.error('❌ Error connecting to Dropbox:', error);
      this.isConnecting = false; // Reset flag on error
    }
  } // Upload files to Dropbox
  async uploadToDropbox(
    accessToken: string,
    refreshToken: string,
    imagesProp: Array<{ fileName: string; filePath: string }>,
    destinationConfig: any,
  ): Promise<any[]> {
    if (!accessToken) {
      await this.connectToDropbox();
    }
    try {
      const results = [];

      const images = await this.getSendFilesArray(imagesProp, destinationConfig);

      for (const image of images) {
        console.log(`📤 Uploading ${image.fileName} to Dropbox...`);

        const fileData = await FileSystem.readFile(image.filePath, 'base64');
        const fileBuffer = Buffer.from(fileData, 'base64');

        const response = await axios({
          method: 'POST',
          url: 'https://content.dropboxapi.com/2/files/upload',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              path: `/${image.fileName}`,
              mode: 'add',
              autorename: true,
            }),
          },
          data: fileBuffer,
        });

        results.push(response.data);
        console.log(`✅ Successfully uploaded ${image.fileName} to Dropbox`);
      }

      return results;
    } catch (error: any) {
      console.error(
        'Dropbox upload error:',
        error.response?.data || error.message,
      );
      if (error.response) {
        if (
          error.response.status === 401 ||
          error.response.data.error_summary?.includes('expired_access_token')
        ) {
          console.log('EXPIRED!!!!!!');
          try {
            const token = await this.refreshDropboxAccessToken(refreshToken);
            if (token) {
              return this.uploadToDropbox(token, refreshToken, imagesProp, destinationConfig); // Retry upload after refreshing token
            } else {
              console.error('❌ Failed to refresh Dropbox access token');
              this.debugCodeVerifierState();
              await this.connectToDropbox();
            }
          } catch (refreshError) {
            console.error(
              '❌ Error refreshing Dropbox access token:',
              refreshError,
            );
            this.debugCodeVerifierState();
            await this.connectToDropbox();
          }
        }
      }
      throw error;
    }
  }

  // get new access token with refresh token
  async refreshDropboxAccessToken(
    refreshToken: string,
  ): Promise<string | null> {
    try {
      const response = await axios.post(
        'https://api.dropbox.com/oauth2/token',
        null,
        {
          params: {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: DROPBOX_CLIENT,
            client_secret: DROPBOX_SECRET,
          },
        },
      );

      if (response.data && response.data.access_token) {
        // Save new access token to settings using Redux
        await getStore().dispatch(
          saveDropboxToken({
            accessToken: response.data.access_token,
            refreshToken: refreshToken,
          }),
        );

        await getStore().dispatch(refreshUser());

        console.log('✅ New Dropbox access token saved to settings');
        return response.data.access_token;
      } else {
        this.connectToDropbox();
        console.error(
          '❌ Invalid response while refreshing Dropbox access token:',
          response.data,
        );
        return null;
      }
    } catch (error) {
      this.connectToDropbox();
      console.error('❌ Error refreshing Dropbox access token:', error);
      return null;
    }
  }

  // ONEDRIVE

  // CONNECT (NEEDS DEEPLINK HANDLING )
  async connectToOneDrive() {
    try {
      // Prevent duplicate OAuth calls (same as Dropbox)
      if (this.isConnecting) {
        console.log(
          '⚠️ OneDrive OAuth already in progress, skipping duplicate call',
        );
        return;
      }

      this.isConnecting = true;

      // Clear any previous code verifier to prevent conflicts
      this.setCodeVerifier(null);
      console.log('🧹 Cleared previous OneDrive code verifier');

      // PKCE parameters for OneDrive
      const verifier = this.generateCodeVerifier();
      const challenge = await this.generateCodeChallenge(verifier);
      const redirectUri = 'berri://onedrive-auth';
      const clientId = ONEDRIVE_CLIENT;
      const scope = 'files.readwrite offline_access';

      // Set the new verifier
      this.setCodeVerifier(verifier);
      console.log(
        '🔑 New OneDrive code verifier set:',
        verifier.substring(0, 10) + '...',
      );

      // Debug OAuth configuration
      console.log('🔧 OneDrive OAuth Configuration:', {
        clientId,
        redirectUri,
        scope,
        codeVerifierLength: verifier.length,
        challengeLength: challenge.length,
        challengeMatchesVerifier: challenge === verifier,
      });

      // DON'T encode redirect_uri - use plain format for consistency (same as Dropbox)
      const authUrl =
        `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `code_challenge=${challenge}&` +
        `code_challenge_method=plain`;

      console.log('🌐 Opening OneDrive OAuth URL...');
      console.log('🔗 Full OneDrive OAuth URL:', authUrl);
      const result = await Linking.openURL(authUrl);
      console.log('🎯 OneDrive Linking.openURL result:', result);

      // Reset the connecting flag after a delay
      setTimeout(() => {
        this.isConnecting = false;
        console.log('✅ OneDrive OAuth connection flag reset');
      }, 5000);
    } catch (error) {
      console.error('❌ OneDrive auth error:', error);
      this.isConnecting = false; // Reset flag on error
    }
  }

  // Upload files to OneDrive
  async uploadToOneDrive(
    accessToken: string,
    refreshToken: string,
    imagesProp: Array<{ fileName: string; filePath: string }>,
    destinationConfig: any,
  ): Promise<any[]> {
    try {
      const results = [];
      const images = await this.getSendFilesArray(imagesProp, destinationConfig);

      for (const image of images) {
        console.log(`📤 Uploading ${image.fileName} to OneDrive...`);

        const fileData = await FileSystem.readFile(image.filePath, 'base64');
        const fileBuffer = Buffer.from(fileData, 'base64');

        const response = await axios({
          method: 'PUT',
          url: `https://graph.microsoft.com/v1.0/me/drive/root:/${image.fileName}:/content`,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
          data: fileBuffer,
        });

        results.push(response.data);
        console.log(`✅ Successfully uploaded ${image.fileName} to OneDrive`);
      }

      return results;
    } catch (error: any) {
      console.error(
        'OneDrive upload error:',
        error.response?.data || error.message,
      );
      if (error.response) {
        if (
          error.response.status === 401 ||
          error.response.data?.error?.code === 'InvalidAuthenticationToken'
        ) {
          console.log('ONEDRIVE EXPIRED!!!!!!');
          try {
            const token = await this.refreshOneDriveAccessToken(refreshToken);
            if (token) {
              return this.uploadToOneDrive(token, refreshToken, imagesProp, destinationConfig); // Retry upload after refreshing token
            } else {
              console.error('❌ Failed to refresh OneDrive access token');
              this.debugCodeVerifierState();
              await this.connectToOneDrive();
            }
          } catch (refreshError) {
            console.error(
              '❌ Error refreshing OneDrive access token:',
              refreshError,
            );
            this.debugCodeVerifierState();
            await this.connectToOneDrive();
          }
        }
      }
      throw error;
    }
  }

  // get new OneDrive access token with refresh token
  async refreshOneDriveAccessToken(
    refreshToken: string,
  ): Promise<string | null> {
    try {
      const params = new URLSearchParams();
      params.append('client_id', ONEDRIVE_CLIENT);
      params.append('scope', 'files.readwrite offline_access');
      params.append('refresh_token', refreshToken);
      params.append('grant_type', 'refresh_token');
      // params.append('client_secret', ONEDRIVE_CLIENT_SECRET);

      const response = await axios.post(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      if (response.data && response.data.access_token) {
        // Save new access token to settings using Redux
        await getStore().dispatch(
          saveOneDriveToken({
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep the old one
          }),
        );

        await getStore().dispatch(refreshUser());

        console.log('✅ New OneDrive access token saved to settings');
        return response.data.access_token;
      } else {
        console.error(
          '❌ Invalid response while refreshing OneDrive access token:',
          response.data,
        );
        return null;
      }
    } catch (error: any) {
      console.error(
        'Response error:',
        error.response?.status,
        error.response?.data,
      );
      console.error(
        '❌ Error refreshing OneDrive access token:',
        JSON.stringify(error),
      );
      return null;
    }
  }

  // GOOGLE DRIVE

  // CONNECT - using Google SignIn library like in ChangeDestinationScreen
  async connectToGoogleDrive() {
    // Import GoogleSignin library
    const {
      GoogleSignin,
    } = require('@react-native-google-signin/google-signin');

    try {
      // Prevent duplicate OAuth calls
      if (this.isConnecting) {
        console.log(
          '⚠️ Google Drive OAuth already in progress, skipping duplicate call',
        );
        return;
      }

      this.isConnecting = true;

      console.log('🔧 Configuring Google Sign-In...');

      // Configure Google Sign-In (same as ChangeDestinationScreen)
      GoogleSignin.configure({
        scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.metadata.readonly',
        ],
        webClientId:
          '827173339361-qgnb9f192crfqc2frvv7d3kkjkv9cnne.apps.googleusercontent.com',
        iosClientId:
          '827173339361-rdo6pt9b7tcn9kacr22qltvc6d462a76.apps.googleusercontent.com',
        offlineAccess: true,
        forceCodeForRefreshToken: true,
        hostedDomain: '',
        loginHint: '',
      });

      console.log('🌐 Starting Google Drive authentication...');

      // Sign out first to clear any cached session with old scopes
      try {
        await GoogleSignin.signOut();
        console.log('🔄 Signed out from previous session');
      } catch (signOutError) {
        console.log('ℹ️ No previous session to sign out from');
      }

      // Check Play Services for Android
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }

      // Sign in
      const userInfo = await GoogleSignin.signIn();
      console.log('👤 Google Drive user info:', userInfo);

      // Get tokens
      const tokens = await GoogleSignin.getTokens();
      console.log('🔑 Google Drive tokens received');

      // Save tokens using Redux
      await getStore().dispatch(
        saveGoogleDriveToken({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || '',
        }),
      );

      await getStore().dispatch(refreshUser());

      console.log('✅ Google Drive tokens saved successfully');

      // Reset the connecting flag
      this.isConnecting = false;
    } catch (error) {
      console.error('❌ Google Drive authentication error:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  async uploadToGoogleDrive(
    accessToken: string,
    refreshToken: string,
    imagesProp: Array<{ fileName: string; filePath: string }>,
    destinationConfig: any,
  ): Promise<any[]> {
    try {
      const results = [];

      const images = await this.getSendFilesArray(imagesProp, destinationConfig);

      for (const image of images) {
        console.log(`📤 Uploading ${image.fileName} to Google Drive...`);

        const fileData = await FileSystem.readFile(image.filePath, 'base64');
        const fileBuffer = Buffer.from(fileData, 'base64');

        // Determine MIME type based on file extension
        const mimeType = image.fileName.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'image/jpeg';

        // Read saved Google Drive folder preference
        let folderId: string | null = null;
        try {
          const folderData = await AsyncStorage.getItem('googleDriveFolder');
          if (folderData) {
            const parsed = JSON.parse(folderData);
            folderId = parsed.id || null;
          }
        } catch (e) {
          console.log('ℹ️ No saved Google Drive folder, uploading to root');
        }

        // Create metadata for Google Drive
        const metadata: any = {
          name: image.fileName,
        };
        if (folderId) {
          metadata.parents = [folderId];
        }

        // Create proper multipart boundary
        const boundary = `----formdata-berri-${Date.now()}`;

        // Build multipart body manually for proper Google Drive API format
        let body = '';

        // Add metadata part
        body += `--${boundary}\r\n`;
        body += `Content-Type: application/json\r\n\r\n`;
        body += `${JSON.stringify(metadata)}\r\n`;

        // Add file part
        body += `--${boundary}\r\n`;
        body += `Content-Type: ${mimeType}\r\n\r\n`;

        // Convert body parts to Buffer and combine
        const bodyStart = Buffer.from(body, 'utf8');
        const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

        // Combine all parts
        const fullBody = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: fullBody,
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Google Drive API Error:', errorText);
          throw new Error(
            `Google Drive upload failed: ${response.status} ${response.statusText}`,
          );
        }

        const result = await response.json();
        results.push(result);
        console.log(
          `✅ Successfully uploaded ${image.fileName} to Google Drive`,
        );
      }

      return results;
    } catch (error: any) {
      console.error('Google Drive upload error:', error.message);
      if (
        error.message?.includes('401') ||
        error.message?.includes('Unauthorized') ||
        error.message?.includes('403') ||
        error.message?.includes('insufficient')
      ) {
        console.log('GOOGLE DRIVE TOKEN EXPIRED OR INSUFFICIENT SCOPES - Re-authenticating...');
        try {
          await this.connectToGoogleDrive();

          const settings = getStore().getState().app.settings;
          console.log(
            '🔄 Retrying Google Drive upload after reconnect',
            settings.googleDriveAccessToken,
          );

          const retryResult = await this.uploadToGoogleDrive(
            settings.googleDriveAccessToken,
            settings.googleDriveRefreshToken,
            imagesProp,
            destinationConfig,
          );

          console.log('✅ Google Drive upload retry successful');
          return retryResult;
        } catch (refreshError) {
          console.error(
            '❌ Error refreshing Google Drive access token:',
            refreshError,
          );
          try {
            await this.connectToGoogleDrive();
            const settings = getStore().getState().app.settings;

            console.log(
              '🔄🔄🔄  Retrying Google Drive upload after reconnect',
              settings.googleDriveAccessToken,
            );

            const secondRetryResult = await this.uploadToGoogleDrive(
              settings.googleDriveAccessToken,
              settings.googleDriveRefreshToken,
              imagesProp,
              destinationConfig,
            );

            console.log('✅ Google Drive upload second retry successful');
            return secondRetryResult;
          } catch (secondRetryError) {
            console.error('❌ Second retry also failed:', secondRetryError);
            throw secondRetryError;
          }
        }
      }
      throw error;
    }
  }

  // Upload file and send to destination emails
  async uploadFileAndSendToRecipients(
    type: number,
    file: File | any, // Can be File object or React Native file object
  ): Promise<{ message: string; sentTo: string[] } | null> {
    try {
      const state = getStore().getState();
      const token = state.app.token;
      if (!token) {
        throw new Error('No auth token found in Redux store');
      }

      console.log('🔑 Auth token found, length:', token.length);
      console.log('👤 Current user:', state.app.user?.email || 'unknown');

      console.log('🚀 sendFilesApi: uploadFileAndSendToRecipients started', {
        type,
        fileName: file?.name || file?.fileName || 'unknown',
        fileSize: file?.size || 'unknown',
        fileUri: file?.uri || 'unknown',
        hasFile: !!file,
      });

      // Create FormData for multipart/form-data upload
      const formData = new FormData();

      // Handle React Native file objects
      if (file?.uri && file?.name) {
        console.log('📎 Using React Native file URI for upload');
        // React Native FormData can handle file URIs directly
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.type || 'image/jpeg',
        } as any);
      } else {
        // Regular File object (web)
        console.log('📎 Using regular File object');
        formData.append('file', file);
      }

      console.log(
        '📤 Making request to:',
        `${API_CONFIG.BASE_URL}/destinations/send/${type}`,
      );

      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/destinations/send/${type}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      console.log('✅ sendFilesApi: File sent successfully', response.data);
      return response.data;
    } catch (error: any) {
      console.error(
        '❌ sendFilesApi: uploadFileAndSendToRecipients failed',
        error,
      );

      // Log detailed error information
      if (error.response) {
        console.error(
          '❌ sendFilesApi: Response status:',
          error.response.status,
        );
        console.error('❌ sendFilesApi: Response data:', error.response.data);
        console.error(
          '❌ sendFilesApi: Response headers:',
          error.response.headers,
        );
      } else if (error.request) {
        console.error(
          '❌ sendFilesApi: Request was made but no response received:',
          error.request,
        );
      } else {
        console.error(
          '❌ sendFilesApi: Error setting up request:',
          error.message,
        );
      }

      return null;
    }
  }

  async convertImageToPdf(imagePaths: string[]): Promise<string | null> {
    try {
      console.log('CONVERT TO PDF');

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      for (const imagePath of imagePaths) {
        // Resize the image to reduce its dimensions and size
        const resizedImage = await ImageResizer.createResizedImage(
          imagePath, // Path to the image
          PDF_EXPORT_WIDTH, // Target width
          PDF_EXPORT_HEIGHT, // Target height
          'JPEG', // Format
          PDF_EXPORT_JPEG_QUALITY, // Quality (0-100)
          0, // Rotation
          RNFS.DocumentDirectoryPath, // Output directory
        );
        // Read the image file as a Uint8Array
        const imageBytes = await RNFS.readFile(resizedImage.uri, 'base64');
        console.log('IMAGE BYTES LENGTH', imageBytes.length);
        const imageBuffer = Uint8Array.from(Buffer.from(imageBytes, 'base64'));

        console.log('IMAGE BUFFER LENGTH', imageBuffer.length);
        // Embed the image in the PDF
        const embeddedImage = await pdfDoc.embedJpg(imageBuffer);

        console.log('EMBEDDED IMAGE', embeddedImage);
        // Get the dimensions of the image
        const { width, height } = embeddedImage;

        // Add a new page to the PDF with the same dimensions as the image
        const page = pdfDoc.addPage([width, height]);

        // Draw the image onto the page
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }

      // Serialize the PDF to bytes
      const pdfBytes = await pdfDoc.save();

      console.log('PDF BYTES LENGTH', pdfBytes.length);

      // Convert the PDF bytes to base64
      const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

      console.log('PDF BASE64 LENGTH', pdfBase64.length);

      // Define the output path for the PDF
      // const outputPath = `${RNFS.DocumentDirectoryPath}/output.pdf`;
      const fileName =
        imagePaths[0].split('/').pop()?.split('.').slice(0, -1).join('.') ||
        'output';
      const path = `${RNFS.DocumentDirectoryPath}/${fileName}.pdf`;

      console.log('OUTPUT PATH', path);
      // Write the PDF to the file system in base64 format
      await RNFS.writeFile(path, pdfBase64, 'base64');

      console.log('✅ PDF created at:', path);
      return path;
    } catch (error) {
      console.error('❌ Error creating PDF:', error);
      return null;
    }
  }

  async getSendFilesArray(
    images: Array<{ fileName: string; filePath: string }>, 
    destination: any
  ): Promise<Array<{ fileName: string; filePath: string }>> {
    const filesArray: Array<{ fileName: string; filePath: string }> = [];

    if (destination.bundled && destination.fileType === 'pdf') {
      try {
        const imagePaths = images.map(img => img.filePath);
        const newFilePath = await this.convertImageToPdf(imagePaths);
        if (newFilePath) {
          const fileNameToSend =
            newFilePath.split('/').pop()?.split('.').slice(0, -1).join('.') +
              '.pdf' || 'bundled.pdf';
          filesArray.push({ fileName: fileNameToSend, filePath: newFilePath });
          return filesArray;
        }
      } catch (error) {
        console.error('❌ Error converting bundled images to PDF:', error);
      }
    } else {
      for (const image of images) {
        let filePathToSend = image.filePath;
        let fileNameToSend = image.fileName;

        if (destination.fileType === 'pdf') {
          try {
            const newFilePath = await this.convertImageToPdf([image.filePath]);
            if (newFilePath) {
              filePathToSend = newFilePath;
              fileNameToSend =
                newFilePath
                  .split('/')
                  .pop()
                  ?.split('.')
                  .slice(0, -1)
                  .join('.') + '.pdf' || fileNameToSend;
            }
          } catch (error) {
            console.error('❌ Error converting image to PDF:', error);
          }
        }

        filesArray.push({ fileName: fileNameToSend, filePath: filePathToSend });
      }
    }

    return filesArray;
  }
}

export const sendFilesApiService = new SendFilesApiService();

// Export individual functions for easier importing
export const uploadFileAndSendToRecipients = (type: number, file: File | any) =>
  sendFilesApiService.uploadFileAndSendToRecipients(type, file);

export default sendFilesApiService;
