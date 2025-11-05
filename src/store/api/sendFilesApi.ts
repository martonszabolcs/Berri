import axios from 'axios';
import { API_CONFIG } from '../../config';
import { store } from '../index';

// Helper service for file sending API calls
class SendFilesApiService {
  
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
