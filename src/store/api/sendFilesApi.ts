import axios from 'axios';
import {
  API_CONFIG,
  DROPBOX_CLIENT_ID,
  DROPBOX_CLIENT_SECRET,
  ONEDRIVE_CLIENT_ID,
  ONEDRIVE_CLIENT_SECRET,
  GOOGLE_DRIVE_CLIENT_ID,
  GOOGLE_DRIVE_CLIENT_SECRET,
} from '../../config';
import { store } from '../index';
import { FileSystem } from 'react-native-file-access';
import { Buffer } from 'buffer';
import { Alert, Linking, Platform } from 'react-native';
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
    destinationId: number,
    destinations,
    history,
    user,
    settings,
    dispatch,
  ) {
    console.log(`📤 Resending to destination ${destinationId}`);

    // Find the destination configuration
    const destinationConfig = destinations.find(
      (dest: any) => dest.type === destinationId,
    );
    const fallbackDestination = {
      type: destinationId,
      destination: 'email',
      emails: user.email,
    };
    const selectedDest = destinationConfig || fallbackDestination;

    // Loop through all files in history entry
    for (const file of history.files) {
      const filePath = file.url;
      const fileName = file.filename;

      console.log(
        `📁 Resending file: ${fileName} to ${selectedDest.destination} with type ${selectedDest.fileType}`,
      );

      let filePathToSend = filePath;
      let fileNameToSend = fileName;

      console.log("filepathtosend", filePathToSend)

      if (selectedDest.fileType === 'pdf') {
        try {
          const newFilePath = await this.convertImageToPdf([filePath]);
          console.log("NEWPATH", newFilePath)
          filePathToSend = newFilePath ?? filePath;
          if (newFilePath) {
            fileNameToSend = newFilePath.split('/').pop()?.split('.').slice(0, -1).join('.') + '.pdf' || fileName;
          }
        } catch (error) {
          console.error('❌ Error converting image to PDF:', error);
        }
      }

      console.log("filepathtosend", filePathToSend)

      if (selectedDest.destination === 'email') {
        console.log('📧 Resending via email to:', user.email);

        try {
          const fileObject = {
            uri: `file://${filePathToSend}`,
            name: fileNameToSend,
            type: fileNameToSend.toLowerCase().endsWith('.pdf')
              ? 'application/pdf'
              : 'image/jpeg',
          };

          const result = await dispatch(
            uploadAndSendFile({
              type: selectedDest.type,
              file: fileObject,
            }),
          );

          if (uploadAndSendFile.fulfilled.match(result)) {
            console.log(
              '✅ File resent via email successfully:',
              result.payload,
            );
          } else {
            console.error('❌ Failed to resend file via email:', result.error);
            throw new Error('Email resend failed');
          }
        } catch (error) {
          console.error('❌ Error resending file via email:', error);
          throw error;
        }
      } else if (selectedDest.destination === 'dropbox') {
        console.log('📤 Resending to Dropbox...');

        try {
          await this.uploadToDropbox(
            settings.dropboxAccessToken,
            settings.dropboxRefreshToken,
            fileNameToSend,
            filePathToSend,
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
            fileNameToSend,
            filePathToSend,
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
            fileNameToSend,
            filePathToSend,
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
        throw new Error(
          `${selectedDest.destination} resend not implemented yet`,
        );
      }
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
      const clientId = 'stli417u8q7kp0a';

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
  } // Upload file to Dropbox
  async uploadToDropbox(
    accessToken: string,
    refreshToken: string,
    fileName: string,
    filePath: string,
  ): Promise<any> {
    try {
      const fileData = await FileSystem.readFile(filePath, 'base64');
      const fileBuffer = Buffer.from(fileData, 'base64');

      const response = await axios({
        method: 'POST',
        url: 'https://content.dropboxapi.com/2/files/upload',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: `/${fileName}`,
            mode: 'add',
            autorename: true,
          }),
        },
        data: fileBuffer,
      });

      return response.data;
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
              this.uploadToDropbox(token, refreshToken, fileName, filePath); // Retry upload after refreshing token
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
            client_id: DROPBOX_CLIENT_ID,
            client_secret: DROPBOX_CLIENT_SECRET,
          },
        },
      );

      if (response.data && response.data.access_token) {
        // Save new access token to settings using Redux
        await store.dispatch(
          saveDropboxToken({
            accessToken: response.data.access_token,
            refreshToken: refreshToken,
          }),
        );

        await store.dispatch(refreshUser());

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
      const clientId = '05a68d6c-e3f6-497b-9fd5-0e54cf3c3be9';
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

  // Upload file to OneDrive
  async uploadToOneDrive(
    accessToken: string,
    refreshToken: string,
    fileName: string,
    filePath: string,
  ): Promise<any> {
    try {
      const fileData = await FileSystem.readFile(filePath, 'base64');
      const fileBuffer = Buffer.from(fileData, 'base64');

      const response = await axios({
        method: 'PUT',
        url: `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        data: fileBuffer,
      });

      return response.data;
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
              return this.uploadToOneDrive(
                token,
                refreshToken,
                fileName,
                filePath,
              ); // Retry upload after refreshing token
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
      params.append('client_id', ONEDRIVE_CLIENT_ID);
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
        await store.dispatch(
          saveOneDriveToken({
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep the old one
          }),
        );

        await store.dispatch(refreshUser());

        console.log('✅ New OneDrive access token saved to settings');
        return response.data.access_token;
      } else {
        console.error(
          '❌ Invalid response while refreshing OneDrive access token:',
          response.data,
        );
        return null;
      }
    } catch (error) {
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
        scopes: ['https://www.googleapis.com/auth/drive.file'],
        webClientId:
          '827173339361-qgnb9f192crfqc2frvv7d3kkjkv9cnne.apps.googleusercontent.com',
        offlineAccess: true,
        forceCodeForRefreshToken: true,
        hostedDomain: '',
        loginHint: '',
      });

      console.log('🌐 Starting Google Drive authentication...');

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
      await store.dispatch(
        saveGoogleDriveToken({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || '',
        }),
      );

      await store.dispatch(refreshUser());

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
    fileName: string,
    filePath: string,
  ): Promise<any> {
    try {
      const fileData = await FileSystem.readFile(filePath, 'base64');
      const fileBuffer = Buffer.from(fileData, 'base64');

      // Determine MIME type based on file extension
      const mimeType = fileName.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'image/jpeg';

      // Create metadata for Google Drive
      const metadata = {
        name: fileName,
      };

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

      return await response.json();
    } catch (error: any) {
      console.error('Google Drive upload error:', error.message);
      if (
        error.message?.includes('401') ||
        error.message?.includes('Unauthorized')
      ) {
        console.log('GOOGLE DRIVE EXPIRED!!!!!!');
        try {
          await this.connectToGoogleDrive();

          const settings = store.getState().app.settings;
          console.log('🔄 Retrying Google Drive upload after reconnect', settings.googleDriveAccessToken);

          const retryResult = await this.uploadToGoogleDrive(
            settings.googleDriveAccessToken,
            settings.googleDriveRefreshToken,
            fileName,
            filePath,
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
            const settings = store.getState().app.settings;

            console.log('🔄🔄🔄  Retrying Google Drive upload after reconnect', settings.googleDriveAccessToken);

            const secondRetryResult = await this.uploadToGoogleDrive(
              settings.googleDriveAccessToken,
              settings.googleDriveRefreshToken,
              fileName,
              filePath,
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
      const state = store.getState();
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

  // jpg to pdf
// async convertImageToPdf(imagePaths: string[]): Promise<string | null> {
//   console.log("CONVERT TO PDF");

//   const objects: string[] = [];
//   const pages: string[] = [];

//   // PDF header
//   let pdf = "%PDF-1.3\n";
//   let objCount = 2; // Start after the Catalog object

//   for (const img of imagePaths) {
//     const base64 = await RNFS.readFile(img, "base64");
//     const imgObjId = objCount++;
//     const pageObjId = objCount++;

//     // Image object
//     objects.push(
//       `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width 595 /Height 842 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${Buffer.from(base64, "base64").length} >>\nstream\n${base64}\nendstream\nendobj`
//     );

//     // Page object
//     objects.push(
//       `${pageObjId} 0 obj\n<< /Type /Page /Parent 1 0 R /Resources << /XObject << /Im${imgObjId} ${imgObjId} 0 R >> >> /MediaBox [0 0 595 842] /Contents ${objCount} 0 R >>\nendobj`
//     );

//     // Page content (Draw Image)
//     const contentObjId = objCount++;
//     objects.push(
//       `${contentObjId} 0 obj\n<< /Length 50 >>\nstream\nq 595 0 0 842 0 0 cm /Im${imgObjId} Do Q\nendstream\nendobj`
//     );

//     pages.push(`${pageObjId} 0 R`);
//   }

//   // Pages object
//   objects.unshift(
//     `1 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${pages.join(" ")}] >>\nendobj`
//   );

//   // Root object (Catalog)
//   objects.unshift(
//     `0 0 obj\n<< /Type /Catalog /Pages 1 0 R >>\nendobj`
//   );

//   pdf += objects.join("\n") + "\n";
//   pdf += "xref\n0 " + objCount + "\n0000000000 65535 f \n";
//   let offset = pdf.length;
//   for (let i = 0; i < objCount; i++) {
//     pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
//     offset += objects[i]?.length || 0;
//   }
//   pdf += `trailer\n<< /Size ${objCount} /Root 0 0 R >>\nstartxref\n${offset}\n%%EOF`;

//   // Save the PDF
//   const fileName =
//     imagePaths[0].split("/").pop()?.split(".").slice(0, -1).join(".") || "output";
//   const path = `${RNFS.DocumentDirectoryPath}/${fileName}.pdf`;

//   try {
//     await RNFS.writeFile(path, pdf, "utf8");
//     console.log("✅ PDF created at:", path);
//     return path;
//   } catch (error) {
//     console.error("❌ PDF WRITE ERROR:", error);
//     return null;
//   }
// }

// async convertImageToPdf(imagePaths: string[]): Promise<string | null> {
//   try {
//     console.log("CONVERT TO PDF");

//     // Create a new PDF document
//     const pdfDoc = await PDFDocument.create();

//     for (const imagePath of imagePaths) {
//       // Read the image file as a Uint8Array
//       const imageBytes = await RNFS.readFile(imagePath, 'base64');
//       const imageBuffer = Uint8Array.from(Buffer.from(imageBytes, 'base64'));

//       // Embed the image in the PDF
//       const embeddedImage = await pdfDoc.embedJpg(imageBuffer);

//       // Get the dimensions of the image
//       const { width, height } = embeddedImage;

//       // Add a new page to the PDF with the same dimensions as the image
//       const page = pdfDoc.addPage([width, height]);

//       // Draw the image onto the page
//       page.drawImage(embeddedImage, {
//         x: 0,
//         y: 0,
//         width,
//         height,
//       });
//     }

//     // Serialize the PDF to bytes
//     const pdfBytes = await pdfDoc.save();

//     // Define the output path for the PDF
//     const fileName =
//     imagePaths[0].split("/").pop()?.split(".").slice(0, -1).join(".") || "output";
//   const outputPath = `${RNFS.DocumentDirectoryPath}/${fileName}.pdf`;


//     // Write the PDF to the file system
//     await RNFS.writeFile(outputPath, pdfBytes, 'base64');

//     console.log("✅ PDF created at:", outputPath);
//     return outputPath;
//   } catch (error) {
//     console.error("❌ Error creating PDF:", error);
//     return null;
//   }
// }

async convertImageToPdf(imagePaths: string[]): Promise<string | null> {
  try {
    console.log("CONVERT TO PDF");

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    for (const imagePath of imagePaths) {

      // Resize the image to reduce its dimensions and size
      const resizedImage = await ImageResizer.createResizedImage(
        imagePath, // Path to the image
        600, // Target width
        900, // Target height
        'JPEG', // Format
        70, // Quality (0-100)
        0, // Rotation
        RNFS.DocumentDirectoryPath // Output directory
      );
      // Read the image file as a Uint8Array
      const imageBytes = await RNFS.readFile(resizedImage.uri, 'base64');
      console.log("IMAGE BYTES LENGTH", imageBytes.length);
      const imageBuffer = Uint8Array.from(Buffer.from(imageBytes, 'base64'));

      console.log("IMAGE BUFFER LENGTH", imageBuffer.length);
      // Embed the image in the PDF
      const embeddedImage = await pdfDoc.embedJpg(imageBuffer);

      console.log("EMBEDDED IMAGE", embeddedImage);
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

    console.log("PDF BYTES LENGTH", pdfBytes.length);

    // Convert the PDF bytes to base64
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    console.log("PDF BASE64 LENGTH", pdfBase64.length);

    // Define the output path for the PDF
    // const outputPath = `${RNFS.DocumentDirectoryPath}/output.pdf`;
  const fileName =
    imagePaths[0].split("/").pop()?.split(".").slice(0, -1).join(".") || "output";
  const path = `${RNFS.DocumentDirectoryPath}/${fileName}.pdf`;


    console.log("OUTPUT PATH", path);
    // Write the PDF to the file system in base64 format
    await RNFS.writeFile(path, pdfBase64, 'base64');

    console.log("✅ PDF created at:", path);
    return path;
  } catch (error) {
    console.error("❌ Error creating PDF:", error);
    return null;
  }
}
}



export const sendFilesApiService = new SendFilesApiService();

// Export individual functions for easier importing
export const uploadFileAndSendToRecipients = (type: number, file: File | any) =>
  sendFilesApiService.uploadFileAndSendToRecipients(type, file);

export default sendFilesApiService;
