import axios from 'axios';
import { API_CONFIG, DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET, ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET } from '../../config';
import { store } from '../index';
import { FileSystem } from 'react-native-file-access';
import { Buffer } from 'buffer';
import { Alert } from 'react-native';
import { saveDropboxToken, saveOneDriveToken } from '../settingsSlice';
import { refreshUser } from '../appSlice';

// Helper service for file sending API calls
class SendFilesApiService {
  
  // Upload file to Dropbox
  async uploadToDropbox(accessToken: string, refreshToken: string, fileName: string, filePath: string): Promise<any> {
    try {
      const fileData = await FileSystem.readFile(filePath, 'base64');
      const fileBuffer = Buffer.from(fileData, 'base64');

      const response = await axios({
        method: 'POST',
        url: 'https://content.dropboxapi.com/2/files/upload',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: `/${fileName}`,
            mode: 'add',
            autorename: true
          })
        },
        data: fileBuffer
      });

      return response.data;
    } catch (error: any) {
      console.error('Dropbox upload error:', error.response?.data || error.message);
      if (error.response) {
        if (error.response.data.error_summary?.includes("expired_access_token")) {
          console.log("EXPIRED!!!!!!")
          try {
            const token = await this.refreshDropboxAccessToken(refreshToken);
            if (token) {
              this.uploadToDropbox(token, refreshToken, fileName, filePath); // Retry upload after refreshing token

            } else {
              console.error('❌ Failed to refresh Dropbox access token');
              Alert.alert('Session Expired', 'Please log in to Dropbox again at the destination setting screen.');
            }
          } catch (refreshError) {
            console.error('❌ Error refreshing Dropbox access token:', refreshError);
            Alert.alert('Session Expired', 'Please log in to Dropbox again at the destination setting screen.');
          }
        }
      }
      throw error;
    }
  }

  // get new access token with refresh token
  async refreshDropboxAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await axios.post('https://api.dropbox.com/oauth2/token', null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: DROPBOX_CLIENT_ID,
          client_secret: DROPBOX_CLIENT_SECRET,
        },
      });

      if (response.data && response.data.access_token) {
        // Save new access token to settings using Redux
        await store.dispatch(saveDropboxToken({
          accessToken: response.data.access_token,
          refreshToken: refreshToken
        }));

        await store.dispatch(refreshUser())
        
        console.log('✅ New Dropbox access token saved to settings');
        return response.data.access_token;
      } else {
        console.error('❌ Invalid response while refreshing Dropbox access token:', response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ Error refreshing Dropbox access token:', error);
      return null;
    }
  }

  // get new OneDrive access token with refresh token
  async refreshOneDriveAccessToken(refreshToken: string): Promise<string | null> {
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
      }
    );

      
      if (response.data && response.data.access_token) {
        // Save new access token to settings using Redux
        await store.dispatch(saveOneDriveToken({
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token || refreshToken // Use new refresh token if provided, otherwise keep the old one
        }));

        await store.dispatch(refreshUser())
        
        console.log('✅ New OneDrive access token saved to settings');
        return response.data.access_token;
      } else {
        console.error('❌ Invalid response while refreshing OneDrive access token:', response.data);
        return null;
      }
    } catch (error) {
      console.error('Response error:', error.response?.status, error.response?.data);
      console.error('❌ Error refreshing OneDrive access token:', JSON.stringify(error));
      return null;
    }
  }

  // Upload file to OneDrive
  async uploadToOneDrive(accessToken: string, refreshToken: string, fileName: string, filePath: string): Promise<any> {
    try {
      const fileData = await FileSystem.readFile(filePath, 'base64');
      const fileBuffer = Buffer.from(fileData, 'base64');

      const response = await axios({
        method: 'PUT',
        url: `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        data: fileBuffer
      });

      return response.data;
    } catch (error: any) {
      console.error('OneDrive upload error:', error.response?.data || error.message);
      if (error.response) {
        if (error.response.status === 401 || error.response.data?.error?.code === "InvalidAuthenticationToken") {
          console.log("ONEDRIVE EXPIRED!!!!!!")
          try {
            const token = await this.refreshOneDriveAccessToken(refreshToken);
            if (token) {
              return this.uploadToOneDrive(token, refreshToken, fileName, filePath); // Retry upload after refreshing token
            } else {
              console.error('❌ Failed to refresh OneDrive access token');
              Alert.alert('Session Expired', 'Please log in to OneDrive again at the destination setting screen.');
            }
          } catch (refreshError) {
            console.error('❌ Error refreshing OneDrive access token:', refreshError);
            Alert.alert('Session Expired', 'Please log in to OneDrive again at the destination setting screen.');
          }
        }
      }
      throw error;
    }
  }
  
  // Upload file and send to destination emails
  async uploadFileAndSendToRecipients(
    type: number,
    file: File | any // Can be File object or React Native file object
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
        hasFile: !!file
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
      
      console.log('📤 Making request to:', `${API_CONFIG.BASE_URL}/destinations/send/${type}`);

      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/destinations/send/${type}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('✅ sendFilesApi: File sent successfully', response.data);
      return response.data;

    } catch (error: any) {
      console.error('❌ sendFilesApi: uploadFileAndSendToRecipients failed', error);
      
      // Log detailed error information
      if (error.response) {
        console.error('❌ sendFilesApi: Response status:', error.response.status);
        console.error('❌ sendFilesApi: Response data:', error.response.data);
        console.error('❌ sendFilesApi: Response headers:', error.response.headers);
      } else if (error.request) {
        console.error('❌ sendFilesApi: Request was made but no response received:', error.request);
      } else {
        console.error('❌ sendFilesApi: Error setting up request:', error.message);
      }
      
      return null;
    }
  }
}

export const sendFilesApiService = new SendFilesApiService();

// Export individual functions for easier importing
export const uploadFileAndSendToRecipients = (type: number, file: File | any) => 
  sendFilesApiService.uploadFileAndSendToRecipients(type, file);

export default sendFilesApiService;
