import axios, { AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Alert } from 'react-native';
import { API_CONFIG } from '../../config';
import { updateCloudStorageToken } from './userApiService';

// OneDrive API Types
export interface OneDriveAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface OneDriveFileMetadata {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  webUrl: string;
  downloadUrl?: string;
}

export interface OneDriveListFilesResponse {
  value: OneDriveFileMetadata[];
  '@odata.nextLink'?: string;
}

export interface OneDriveUploadResponse {
  id: string;
  name: string;
  size: number;
  webUrl: string;
}

// OneDrive API Configuration
const ONEDRIVE_CONFIG = {
  CLIENT_ID: 'YOUR_MICROSOFT_CLIENT_ID', // TODO: Move to config
  CLIENT_SECRET: 'YOUR_MICROSOFT_CLIENT_SECRET', // TODO: Move to config
  REDIRECT_URI: 'berri://microsoft-auth',
  SCOPE: 'files.readwrite user.read offline_access',
  API_BASE_URL: 'https://graph.microsoft.com/v1.0',
  OAUTH_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  TOKEN_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

class OneDriveApiService {
  // Check if user has valid OneDrive token
  async hasValidToken(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('onedrive_token');
      if (!token) return false;

      // Test token validity by making a simple API call
      const response = await axios.get(
        `${ONEDRIVE_CONFIG.API_BASE_URL}/me`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response.status === 200;
    } catch (error: any) {
      console.error('OneDrive token validation error:', error);
      
      // Try to refresh token if it's expired
      if (error.response?.status === 401) {
        const refreshSuccess = await this.refreshToken();
        return refreshSuccess;
      }
      
      // Remove invalid token
      await AsyncStorage.removeItem('onedrive_token');
      await AsyncStorage.removeItem('onedrive_refresh_token');
      return false;
    }
  }

  // Get stored OneDrive token
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem('onedrive_token');
  }

  // Get stored refresh token
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem('onedrive_refresh_token');
  }

  // Save OneDrive tokens
  async saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
    await AsyncStorage.setItem('onedrive_token', accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem('onedrive_refresh_token', refreshToken);
    }
  }

  // Remove OneDrive tokens
  async removeTokens(): Promise<void> {
    await AsyncStorage.removeItem('onedrive_token');
    await AsyncStorage.removeItem('onedrive_refresh_token');
  }

  // Refresh access token
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) return false;

      const response = await axios.post(
        ONEDRIVE_CONFIG.TOKEN_URL,
        new URLSearchParams({
          client_id: ONEDRIVE_CONFIG.CLIENT_ID,
          client_secret: ONEDRIVE_CONFIG.CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token: newRefreshToken } = response.data;
      await this.saveTokens(access_token, newRefreshToken);

      return true;
    } catch (error) {
      console.error('OneDrive token refresh error:', error);
      await this.removeTokens();
      return false;
    }
  }

  // Start OneDrive OAuth flow
  async authenticate(): Promise<boolean> {
    try {
      const authUrl = `${ONEDRIVE_CONFIG.OAUTH_URL}?` +
        `client_id=${ONEDRIVE_CONFIG.CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(ONEDRIVE_CONFIG.REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(ONEDRIVE_CONFIG.SCOPE)}&` +
        `response_mode=query`;

      // Check if URL can be opened
      const supported = await Linking.canOpenURL(authUrl);
      if (!supported) {
        Alert.alert('Hiba', 'Nem sikerült megnyitni a OneDrive authentikációt');
        return false;
      }

      // Open Microsoft auth in browser
      await Linking.openURL(authUrl);

      // Listen for redirect
      return new Promise((resolve) => {
        const handleUrl = async (event: { url: string }) => {
          if (event.url.startsWith(ONEDRIVE_CONFIG.REDIRECT_URI)) {
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
      console.error('OneDrive authentication error:', error);
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
      const response = await axios.post(
        ONEDRIVE_CONFIG.TOKEN_URL,
        new URLSearchParams({
          client_id: ONEDRIVE_CONFIG.CLIENT_ID,
          client_secret: ONEDRIVE_CONFIG.CLIENT_SECRET,
          code: code,
          redirect_uri: ONEDRIVE_CONFIG.REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token } = response.data;
      await this.saveTokens(access_token, refresh_token);

      return true;
    } catch (error) {
      console.error('Token exchange error:', error);
      return false;
    }
  }

  // Connect OneDrive token to backend
  async connectToBackend(): Promise<boolean> {
    try {
      const oneDriveToken = await this.getToken();
      if (!oneDriveToken) {
        throw new Error('No OneDrive token found');
      }

      // Send OneDrive token to backend using userApiService
      await updateCloudStorageToken('onedrive', oneDriveToken);
      return true;
    } catch (error) {
      console.error('Backend connection error:', error);
      return false;
    }
  }

  // Upload file to OneDrive via backend
  async uploadFile(fileUri: string, fileName: string): Promise<OneDriveUploadResponse | null> {
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
      formData.append('storageType', 'onedrive');

      const response: AxiosResponse<OneDriveUploadResponse> = await axios.post(
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
      console.error('OneDrive upload error:', error);
      return null;
    }
  }

  // List files from OneDrive via backend
  async listFiles(): Promise<OneDriveFileMetadata[]> {
    try {
      const jwtToken = await AsyncStorage.getItem('authToken');
      if (!jwtToken) {
        throw new Error('No auth token found');
      }

      // Note: This endpoint may need to be created in the backend
      const response: AxiosResponse<{ files: OneDriveFileMetadata[] }> = await axios.post(
        `${API_CONFIG.BASE_URL}/files/onedrive-files`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
          },
        }
      );

      return response.data.files || [];
    } catch (error) {
      console.error('OneDrive list files error:', error);
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
      console.error('OneDrive connection check error:', error);
      return { isConnected: false, error: 'Connection check failed' };
    }
  }

  // Get user info from OneDrive
  async getUserInfo(): Promise<any> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No OneDrive token found');
      }

      const response = await axios.get(
        `${ONEDRIVE_CONFIG.API_BASE_URL}/me`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Get OneDrive user info error:', error);
      return null;
    }
  }

  // Disconnect OneDrive
  async disconnect(): Promise<boolean> {
    try {
      // Remove local tokens
      await this.removeTokens();

      // Update backend to remove OneDrive connection
      const jwtToken = await AsyncStorage.getItem('authToken');
      if (jwtToken) {
        await axios.put(
          `${API_CONFIG.BASE_URL}/users/me`,
          { oneDriveAccessToken: null },
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
      console.error('OneDrive disconnect error:', error);
      return false;
    }
  }
}

export const oneDriveApi = new OneDriveApiService();
export default oneDriveApi;