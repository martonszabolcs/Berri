import axios, { AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Alert } from 'react-native';
import { API_CONFIG } from '../../config';
import { updateCloudStorageToken } from './userApiService';

// Google Drive API Types
export interface GoogleDriveAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  size: string;
  modifiedTime: string;
  mimeType: string;
  webViewLink: string;
}

export interface GoogleDriveListFilesResponse {
  files: GoogleDriveFileMetadata[];
  nextPageToken?: string;
}

export interface GoogleDriveUploadResponse {
  id: string;
  name: string;
  size: string;
  mimeType: string;
}

// Google Drive API Configuration
const GOOGLE_DRIVE_CONFIG = {
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID', // TODO: Move to config
  CLIENT_SECRET: 'YOUR_GOOGLE_CLIENT_SECRET', // TODO: Move to config
  REDIRECT_URI: 'berri://google-auth',
  SCOPE: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
  API_BASE_URL: 'https://www.googleapis.com/drive/v3',
  OAUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
};

class GoogleDriveApiService {
  // Check if user has valid Google Drive token
  async hasValidToken(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('googledrive_token');
      if (!token) return false;

      // Test token validity by making a simple API call
      const response = await axios.get(
        `${GOOGLE_DRIVE_CONFIG.API_BASE_URL}/about?fields=user`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response.status === 200;
    } catch (error: any) {
      console.error('Google Drive token validation error:', error);
      
      // Try to refresh token if it's expired
      if (error.response?.status === 401) {
        const refreshSuccess = await this.refreshToken();
        return refreshSuccess;
      }
      
      // Remove invalid token
      await AsyncStorage.removeItem('googledrive_token');
      await AsyncStorage.removeItem('googledrive_refresh_token');
      return false;
    }
  }

  // Get stored Google Drive token
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem('googledrive_token');
  }

  // Get stored refresh token
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem('googledrive_refresh_token');
  }

  // Save Google Drive tokens
  async saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
    await AsyncStorage.setItem('googledrive_token', accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem('googledrive_refresh_token', refreshToken);
    }
  }

  // Remove Google Drive tokens
  async removeTokens(): Promise<void> {
    await AsyncStorage.removeItem('googledrive_token');
    await AsyncStorage.removeItem('googledrive_refresh_token');
  }

  // Refresh access token
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) return false;

      const response = await axios.post(GOOGLE_DRIVE_CONFIG.TOKEN_URL, {
        client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
        client_secret: GOOGLE_DRIVE_CONFIG.CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;
      await this.saveTokens(access_token, newRefreshToken);

      return true;
    } catch (error) {
      console.error('Google Drive token refresh error:', error);
      await this.removeTokens();
      return false;
    }
  }

  // Start Google Drive OAuth flow
  async authenticate(): Promise<boolean> {
    try {
      const authUrl = `${GOOGLE_DRIVE_CONFIG.OAUTH_URL}?` +
        `client_id=${GOOGLE_DRIVE_CONFIG.CLIENT_ID}&` +
        `redirect_uri=${GOOGLE_DRIVE_CONFIG.REDIRECT_URI}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(GOOGLE_DRIVE_CONFIG.SCOPE)}&` +
        `access_type=offline&` +
        `prompt=consent`;

      // Check if URL can be opened
      const supported = await Linking.canOpenURL(authUrl);
      if (!supported) {
        Alert.alert('Hiba', 'Nem sikerült megnyitni a Google Drive authentikációt');
        return false;
      }

      // Open Google auth in browser
      await Linking.openURL(authUrl);

      // Listen for redirect
      return new Promise((resolve) => {
        const handleUrl = async (event: { url: string }) => {
          if (event.url.startsWith(GOOGLE_DRIVE_CONFIG.REDIRECT_URI)) {
            const code = this.extractCodeFromUrl(event.url);
            Linking.removeAllListeners('url');
            
            if (code) {
              const tokenSuccess = await this.exchangeCodeForToken(code);
              resolve(tokenSuccess);
            } else {
              resolve(false);
            }
          }
        };

        const linkingListener = Linking.addEventListener('url', handleUrl);

        // Cleanup after 5 minutes
        setTimeout(() => {
          linkingListener?.remove();
          resolve(false);
        }, 300000);
      });
    } catch (error) {
      console.error('Google Drive authentication error:', error);
      return false;
    }
  }

  // Extract authorization code from OAuth redirect URL
  private extractCodeFromUrl(url: string): string | null {
    try {
      const match = url.match(/code=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch (error) {
      console.error('Code extraction error:', error);
      return null;
    }
  }

  // Exchange authorization code for access token
  private async exchangeCodeForToken(code: string): Promise<boolean> {
    try {
      const response = await axios.post(GOOGLE_DRIVE_CONFIG.TOKEN_URL, {
        client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
        client_secret: GOOGLE_DRIVE_CONFIG.CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: GOOGLE_DRIVE_CONFIG.REDIRECT_URI,
      });

      const { access_token, refresh_token } = response.data;
      await this.saveTokens(access_token, refresh_token);

      return true;
    } catch (error) {
      console.error('Token exchange error:', error);
      return false;
    }
  }

  // Connect Google Drive token to backend
  async connectToBackend(): Promise<boolean> {
    try {
      const googleDriveToken = await this.getToken();
      if (!googleDriveToken) {
        throw new Error('No Google Drive token found');
      }

      // Send Google Drive token to backend using userApiService
      await updateCloudStorageToken('googledrive', googleDriveToken);
      return true;
    } catch (error) {
      console.error('Backend connection error:', error);
      return false;
    }
  }

  // Upload file to Google Drive via backend
  async uploadFile(fileUri: string, fileName: string): Promise<GoogleDriveUploadResponse | null> {
    try {
      const jwtToken = await AsyncStorage.getItem('authToken');
      if (!jwtToken) {
        throw new Error('No auth token found');
      }

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: 'application/pdf',
        name: fileName,
      } as any);
      formData.append('storageType', 'googledrive');

      const response: AxiosResponse<GoogleDriveUploadResponse> = await axios.post(
        `${API_CONFIG.BASE_URL}/files/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Google Drive upload error:', error);
      return null;
    }
  }

  // List files from Google Drive via backend
  async listFiles(): Promise<GoogleDriveFileMetadata[]> {
    try {
      const jwtToken = await AsyncStorage.getItem('authToken');
      if (!jwtToken) {
        throw new Error('No auth token found');
      }

      // Note: This endpoint may need to be created in the backend
      const response: AxiosResponse<{ files: GoogleDriveFileMetadata[] }> = await axios.post(
        `${API_CONFIG.BASE_URL}/files/googledrive-files`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
          },
        }
      );

      return response.data.files || [];
    } catch (error) {
      console.error('Google Drive list files error:', error);
      return [];
    }
  }

  // Check connection status and connect if needed
  async ensureConnection(): Promise<{ isConnected: boolean; error?: string }> {
    try {
      // Check if we have a valid token
      const hasToken = await this.hasValidToken();
      
      if (!hasToken) {
        // No valid token, need to authenticate
        const authSuccess = await this.authenticate();
        if (!authSuccess) {
          return { isConnected: false, error: 'Authentication failed' };
        }
      }

      // Connect to backend
      const backendSuccess = await this.connectToBackend();
      if (!backendSuccess) {
        return { isConnected: false, error: 'Backend connection failed' };
      }

      return { isConnected: true };
    } catch (error) {
      console.error('Google Drive connection check error:', error);
      return { isConnected: false, error: 'Connection check failed' };
    }
  }

  // Get user info from Google Drive
  async getUserInfo(): Promise<any> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No Google Drive token found');
      }

      const response = await axios.get(
        `${GOOGLE_DRIVE_CONFIG.API_BASE_URL}/about?fields=user`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response.data.user;
    } catch (error) {
      console.error('Get Google Drive user info error:', error);
      return null;
    }
  }

  // Disconnect Google Drive
  async disconnect(): Promise<boolean> {
    try {
      // Remove local tokens
      await this.removeTokens();

      // Update backend to remove Google Drive connection
      const jwtToken = await AsyncStorage.getItem('authToken');
      if (jwtToken) {
        await axios.put(
          `${API_CONFIG.BASE_URL}/users/me`,
          { googleDriveAccessToken: null },
          {
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      return true;
    } catch (error) {
      console.error('Google Drive disconnect error:', error);
      return false;
    }
  }
}

export const googleDriveApi = new GoogleDriveApiService();
export default googleDriveApi;