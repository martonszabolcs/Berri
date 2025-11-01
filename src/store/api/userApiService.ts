import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../config';

// Helper service for user-related API calls
class UserApiService {
  // Get current user ID
  async getCurrentUserId(): Promise<number | null> {
    try {
      const jwtToken = await AsyncStorage.getItem('authToken');
      if (!jwtToken) {
        throw new Error('No auth token found');
      }

      const response = await axios.get(
        `${API_CONFIG.BASE_URL}/users/me`,
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
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

      const jwtToken = await AsyncStorage.getItem('authToken');
      if (!jwtToken) {
        throw new Error('No auth token found');
      }

      const response = await axios.put(
        `${API_CONFIG.BASE_URL}/users/${userId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
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

  // Update cloud storage token for current user
  async updateCloudStorageToken(storageType: 'dropbox' | 'googledrive' | 'onedrive', accessToken: string): Promise<boolean> {
    const tokenFieldMap = {
      dropbox: 'dropboxAccessToken',
      googledrive: 'googleDriveAccessToken', // Based on Swagger: User schema has this field
      onedrive: 'oneDriveAccessToken', // Based on Swagger: User schema has this field
    };

    const fieldName = tokenFieldMap[storageType];
    const updateData = { [fieldName]: accessToken };

    return this.updateCurrentUser(updateData);
  }
}

export const userApiService = new UserApiService();

// Export individual functions for easier importing
export const getCurrentUserId = () => userApiService.getCurrentUserId();
export const updateCurrentUser = (data: any) => userApiService.updateCurrentUser(data);
export const updateCloudStorageToken = (storageType: 'dropbox' | 'googledrive' | 'onedrive', accessToken: string) => 
  userApiService.updateCloudStorageToken(storageType, accessToken);

export default userApiService;