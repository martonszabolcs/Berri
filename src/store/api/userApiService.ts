import axios from 'axios';
import { API_CONFIG } from '../../config';
import { store } from '../index';

// Helper service for user-related API calls
class UserApiService {
  // Get current user ID
  async getCurrentUserId(): Promise<number | null> {
    try {
      const state = store.getState();
      const token = state.app.token;
      if (!token) {
        throw new Error('No auth token found in Redux store');
      }

      const response = await axios.get(
        `${API_CONFIG.BASE_URL}/users/me`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response.data.id;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }

  // Update current user (wrapper for PUT /users/{id})
  async updateCurrentUser(updateData: any): Promise<boolean> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Could not get current user ID');
      }

      const state = store.getState();
      const token = state.app.token;
      if (!token) {
        throw new Error('No auth token found in Redux store');
      }

      const response = await axios.put(
        `${API_CONFIG.BASE_URL}/users/${userId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error('Error updating current user:', error);
      return false;
    }
  }

  // Update cloud storage tokens for current user using the dedicated settings endpoint
  async updateCloudStorageTokens(storageType: 'dropbox' | 'googledrive' | 'onedrive', tokens: { accessToken: string; refreshToken?: string }): Promise<boolean> {
    const tokenFieldMap = {
      dropbox: {
        accessToken: 'dropboxAccessToken',
        refreshToken: 'dropboxRefreshToken'
      },
      googledrive: {
        accessToken: 'googleDriveAccessToken',
        refreshToken: 'googleDriveRefreshToken'
      },
      onedrive: {
        accessToken: 'oneDriveAccessToken', 
        refreshToken: 'oneDriveRefreshToken'
      }
    };

    const fields = tokenFieldMap[storageType];
    const updateData: any = { [fields.accessToken]: tokens.accessToken };
    
    // Add refresh token if provided
    if (tokens.refreshToken) {
      updateData[fields.refreshToken] = tokens.refreshToken;
    }

    return this.updateUserSettings(updateData);
  }

  // Update user settings using the dedicated /settings endpoint
  async updateUserSettings(updateData: any): Promise<boolean> {
    try {
      const state = store.getState();
      const token = state.app.token;
      if (!token) {
        throw new Error('No auth token found in Redux store');
      }

      console.log('🚀 userApiService: Updating user settings', updateData);
      console.log('🔑 userApiService: Using token:', token.substring(0, 50) + '...');
      console.log('🌐 userApiService: API URL:', `${API_CONFIG.BASE_URL}/settings`);

      const response = await axios.put(
        `${API_CONFIG.BASE_URL}/settings`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ userApiService: Settings updated successfully', response.data);
      return response.status === 200;
    } catch (error: any) {
      console.error('❌ userApiService: Error updating user settings:', error);
      
      // Log detailed error information
      if (error.response) {
        console.error('❌ userApiService: Response status:', error.response.status);
        console.error('❌ userApiService: Response data:', error.response.data);
        console.error('❌ userApiService: Response headers:', error.response.headers);
      } else if (error.request) {
        console.error('❌ userApiService: Request was made but no response received:', error.request);
      } else {
        console.error('❌ userApiService: Error setting up request:', error.message);
      }
      
      return false;
    }
  }

  // Update cloud storage token for current user (legacy method - kept for backwards compatibility)
  async updateCloudStorageToken(storageType: 'dropbox' | 'googledrive' | 'onedrive', accessToken: string): Promise<boolean> {
    return this.updateCloudStorageTokens(storageType, { accessToken });
  }

  // Update destination settings for a specific destination type
  async updateDestinationSettings(
    destinationType: string, 
    settings: { 
      destination?: string; 
      fileType?: string; 
      bundled?: boolean; 
      emails?: string;
    }
  ): Promise<boolean> {
    try {
      const state = store.getState();
      const token = state.app.token;
      if (!token) {
        throw new Error('No auth token found in Redux store');
      }

      // Build the request body - only include fields that are provided
      const body: any = {};
      
      if (settings.destination !== undefined) {
        body.destination = settings.destination.toLowerCase();
        // If destination is not email, set emails to empty string
        if (settings.destination.toLowerCase() !== 'email') {
          body.emails = '';
        }
      }
      
      if (settings.fileType !== undefined) {
        body.fileType = settings.fileType;
      }
      
      if (settings.bundled !== undefined) {
        body.bundled = settings.bundled;
      }
      
      if (settings.emails !== undefined && settings.destination?.toLowerCase() === 'email') {
        body.emails = settings.emails;
      }

      console.log('🚀 destinationApi: Updating destination settings', { destinationType, body });
      console.log('🔑 destinationApi: Using token:', token.substring(0, 50) + '...');
      console.log('🌐 destinationApi: API URL:', `${API_CONFIG.BASE_URL}/destinations/${destinationType}`);

      const response = await axios.put(
        `${API_CONFIG.BASE_URL}/destinations/${destinationType}`,
        body,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ destinationApi: Destination settings updated successfully', response.data);
      return response.status === 200;
    } catch (error: any) {
      console.error('❌ destinationApi: Error updating destination settings:', error);
      
      // Log detailed error information
      if (error.response) {
        console.error('❌ destinationApi: Response status:', error.response.status);
        console.error('❌ destinationApi: Response data:', error.response.data);
        console.error('❌ destinationApi: Response headers:', error.response.headers);
      } else if (error.request) {
        console.error('❌ destinationApi: Request was made but no response received:', error.request);
      } else {
        console.error('❌ destinationApi: Error setting up request:', error.message);
      }
      
      return false;
    }
  }
}

export const userApiService = new UserApiService();

// Export individual functions for easier importing
export const getCurrentUserId = () => userApiService.getCurrentUserId();
export const updateCurrentUser = (data: any) => userApiService.updateCurrentUser(data);
export const updateUserSettings = (data: any) => userApiService.updateUserSettings(data);
export const updateCloudStorageToken = (storageType: 'dropbox' | 'googledrive' | 'onedrive', accessToken: string) => 
  userApiService.updateCloudStorageToken(storageType, accessToken);
export const updateCloudStorageTokens = (storageType: 'dropbox' | 'googledrive' | 'onedrive', tokens: { accessToken: string; refreshToken?: string }) =>
  userApiService.updateCloudStorageTokens(storageType, tokens);
export const updateDestinationSettings = (
  destinationType: string, 
  settings: { 
    destination?: string; 
    fileType?: string; 
    bundled?: boolean; 
    emails?: string;
  }
) => userApiService.updateDestinationSettings(destinationType, settings);

export default userApiService;