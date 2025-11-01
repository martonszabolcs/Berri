import axios, { AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Alert } from 'react-native';
import { API_CONFIG } from '../../config';
import { updateCloudStorageToken } from './userApiService';

// Dropbox API Types
export interface DropboxAuthResponse {
  access_token: string;
  token_type: string;
  uid: string;
  account_id: string;
}

export interface DropboxFileMetadata {
  name: string;
  path_lower: string;
  size: number;
  server_modified: string;
  id: string;
}

export interface DropboxListFilesResponse {
  entries: DropboxFileMetadata[];
  cursor: string;
  has_more: boolean;
}

export interface DropboxUploadResponse {
  name: string;
  path_lower: string;
  size: number;
  id: string;
}

// Dropbox API Configuration
const DROPBOX_CONFIG = {
  APP_KEY: 'YOUR_DROPBOX_APP_KEY', // TODO: Move to config
  REDIRECT_URI: 'berri://dropbox-auth',
  API_BASE_URL: 'https://api.dropboxapi.com/2',
  CONTENT_API_URL: 'https://content.dropboxapi.com/2',
};

class DropboxApiService {
  // Check if user has valid Dropbox token
  async hasValidToken(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('dropbox_token');
      if (!token) return false;

      // Test token validity by making a simple API call
      const response = await axios.post(
        `${DROPBOX_CONFIG.API_BASE_URL}/users/get_current_account`,
        null,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error('Dropbox token validation error:', error);
      // Remove invalid token
      await AsyncStorage.removeItem('dropbox_token');
      return false;
    }
  }

  // Get stored Dropbox token
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem('dropbox_token');
  }

  // Save Dropbox token
  async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem('dropbox_token', token);
  }

  // Remove Dropbox token
  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem('dropbox_token');
  }

  // Start Dropbox OAuth flow
  async authenticate(): Promise<boolean> {
    try {
      const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_CONFIG.APP_KEY}&redirect_uri=${DROPBOX_CONFIG.REDIRECT_URI}&response_type=token`;

      // Check if URL can be opened
      const supported = await Linking.canOpenURL(authUrl);
      if (!supported) {
        Alert.alert('Hiba', 'Nem sikerült megnyitni a Dropbox authentikációt');
        return false;
      }

      // Open Dropbox auth in browser
      await Linking.openURL(authUrl);

      // Listen for redirect
      return new Promise((resolve) => {
        const handleUrl = (event: { url: string }) => {
          if (event.url.startsWith(DROPBOX_CONFIG.REDIRECT_URI)) {
            const token = this.extractTokenFromUrl(event.url);
            Linking.removeAllListeners('url');
            
            if (token) {
              this.saveToken(token);
              resolve(true);
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
      console.error('Dropbox authentication error:', error);
      return false;
    }
  }

  // Extract token from OAuth redirect URL
  private extractTokenFromUrl(url: string): string | null {
    try {
      const match = url.match(/access_token=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch (error) {
      console.error('Token extraction error:', error);
      return null;
    }
  }

  // Connect Dropbox token to backend
  async connectToBackend(): Promise<boolean> {
    try {
      const dropboxToken = await this.getToken();
      if (!dropboxToken) {
        throw new Error('No Dropbox token found');
      }

      // Send Dropbox token to backend using userApiService
      await updateCloudStorageToken('dropbox', dropboxToken);
      return true;
    } catch (error) {
      console.error('Backend connection error:', error);
      return false;
    }
  }

  // Upload file to Dropbox via backend
  async uploadFile(fileUri: string, fileName: string): Promise<DropboxUploadResponse | null> {
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
      formData.append('storageType', 'dropbox');

      const response: AxiosResponse<DropboxUploadResponse> = await axios.post(
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
      console.error('Dropbox upload error:', error);
      return null;
    }
  }

  // List files from Dropbox via backend
  async listFiles(): Promise<DropboxFileMetadata[]> {
    try {
      const jwtToken = await AsyncStorage.getItem('authToken');
      if (!jwtToken) {
        throw new Error('No auth token found');
      }

      const response: AxiosResponse<{ files: DropboxFileMetadata[] }> = await axios.post(
        `${API_CONFIG.BASE_URL}/files/dropbox-files`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
          },
        }
      );

      return response.data.files || [];
    } catch (error) {
      console.error('Dropbox list files error:', error);
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
      console.error('Dropbox connection check error:', error);
      return { isConnected: false, error: 'Connection check failed' };
    }
  }

  // Get user info from Dropbox
  async getUserInfo(): Promise<any> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No Dropbox token found');
      }

      const response = await axios.post(
        `${DROPBOX_CONFIG.API_BASE_URL}/users/get_current_account`,
        null,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Get Dropbox user info error:', error);
      return null;
    }
  }

  // Disconnect Dropbox
  async disconnect(): Promise<boolean> {
    try {
      // Remove local token
      await this.removeToken();

      // Update backend to remove Dropbox connection
      const jwtToken = await AsyncStorage.getItem('authToken');
      if (jwtToken) {
        await axios.put(
          `${API_CONFIG.BASE_URL}/users/me`,
          { dropboxAccessToken: null },
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
      console.error('Dropbox disconnect error:', error);
      return false;
    }
  }
}

export const dropboxApi = new DropboxApiService();
export default dropboxApi;