import dropboxApi from './dropboxApi';
import googleDriveApi from './googleDriveApi';
import oneDriveApi from './oneDriveApi';

// Cloud storage types
export type CloudStorageType = 'dropbox' | 'googledrive' | 'onedrive';

// Unified interface for all cloud storage services
export interface CloudStorageService {
  hasValidToken(): Promise<boolean>;
  authenticate(): Promise<boolean>;
  ensureConnection(): Promise<{ isConnected: boolean; error?: string }>;
  uploadFile(fileUri: string, fileName: string): Promise<any>;
  listFiles(): Promise<any[]>;
  getUserInfo(): Promise<any>;
  disconnect(): Promise<boolean>;
}

// Cloud storage connection result
export interface CloudStorageConnectionResult {
  isConnected: boolean;
  storageType: CloudStorageType;
  error?: string;
  userInfo?: any;
}

class CloudStorageManager {
  // Get the appropriate API service for a storage type
  private getApiService(storageType: CloudStorageType): CloudStorageService {
    switch (storageType) {
      case 'dropbox':
        return dropboxApi;
      case 'googledrive':
        return googleDriveApi;
      case 'onedrive':
        return oneDriveApi;
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  // Check if a specific storage type is connected
  async isConnected(storageType: CloudStorageType): Promise<boolean> {
    try {
      const service = this.getApiService(storageType);
      return await service.hasValidToken();
    } catch (error) {
      console.error(`Error checking ${storageType} connection:`, error);
      return false;
    }
  }

  // Connect to a specific cloud storage service
  async connect(storageType: CloudStorageType): Promise<CloudStorageConnectionResult> {
    try {
      const service = this.getApiService(storageType);
      
      // Check if already connected
      const alreadyConnected = await service.hasValidToken();
      if (alreadyConnected) {
        const userInfo = await service.getUserInfo();
        return {
          isConnected: true,
          storageType,
          userInfo,
        };
      }

      // Attempt to connect
      const connectionResult = await service.ensureConnection();
      
      if (connectionResult.isConnected) {
        const userInfo = await service.getUserInfo();
        return {
          isConnected: true,
          storageType,
          userInfo,
        };
      } else {
        return {
          isConnected: false,
          storageType,
          error: connectionResult.error,
        };
      }
    } catch (error) {
      console.error(`Error connecting to ${storageType}:`, error);
      return {
        isConnected: false,
        storageType,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Disconnect from a specific cloud storage service
  async disconnect(storageType: CloudStorageType): Promise<boolean> {
    try {
      const service = this.getApiService(storageType);
      return await service.disconnect();
    } catch (error) {
      console.error(`Error disconnecting from ${storageType}:`, error);
      return false;
    }
  }

  // Upload file to a specific cloud storage service
  async uploadFile(
    storageType: CloudStorageType, 
    fileUri: string, 
    fileName: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const service = this.getApiService(storageType);
      
      // Check if connected first
      const isConnected = await service.hasValidToken();
      if (!isConnected) {
        return {
          success: false,
          error: `Not connected to ${storageType}. Please connect first.`,
        };
      }

      const result = await service.uploadFile(fileUri, fileName);
      
      if (result) {
        return {
          success: true,
          data: result,
        };
      } else {
        return {
          success: false,
          error: 'Upload failed',
        };
      }
    } catch (error) {
      console.error(`Error uploading to ${storageType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // List files from a specific cloud storage service
  async listFiles(storageType: CloudStorageType): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      const service = this.getApiService(storageType);
      
      // Check if connected first
      const isConnected = await service.hasValidToken();
      if (!isConnected) {
        return {
          success: false,
          error: `Not connected to ${storageType}`,
        };
      }

      const files = await service.listFiles();
      
      return {
        success: true,
        files,
      };
    } catch (error) {
      console.error(`Error listing files from ${storageType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list files',
      };
    }
  }

  // Get user info from a specific cloud storage service
  async getUserInfo(storageType: CloudStorageType): Promise<{ success: boolean; userInfo?: any; error?: string }> {
    try {
      const service = this.getApiService(storageType);
      
      const userInfo = await service.getUserInfo();
      
      if (userInfo) {
        return {
          success: true,
          userInfo,
        };
      } else {
        return {
          success: false,
          error: 'Failed to get user info',
        };
      }
    } catch (error) {
      console.error(`Error getting user info from ${storageType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user info',
      };
    }
  }

  // Check connection status for all storage types
  async getConnectionStatus(): Promise<Record<CloudStorageType, boolean>> {
    const [dropboxConnected, googleDriveConnected, oneDriveConnected] = await Promise.all([
      this.isConnected('dropbox'),
      this.isConnected('googledrive'),
      this.isConnected('onedrive'),
    ]);

    return {
      dropbox: dropboxConnected,
      googledrive: googleDriveConnected,
      onedrive: oneDriveConnected,
    };
  }

  // Get available (connected) storage types
  async getAvailableStorageTypes(): Promise<CloudStorageType[]> {
    const connectionStatus = await this.getConnectionStatus();
    
    return Object.entries(connectionStatus)
      .filter(([_, isConnected]) => isConnected)
      .map(([storageType, _]) => storageType as CloudStorageType);
  }

  // Check if any storage is connected
  async hasAnyConnection(): Promise<boolean> {
    const connectionStatus = await this.getConnectionStatus();
    return Object.values(connectionStatus).some(isConnected => isConnected);
  }

  // Get the display name for a storage type
  getStorageDisplayName(storageType: CloudStorageType): string {
    switch (storageType) {
      case 'dropbox':
        return 'Dropbox';
      case 'googledrive':
        return 'Google Drive';
      case 'onedrive':
        return 'OneDrive';
      default:
        return storageType;
    }
  }

  // Get the icon name for a storage type (for UI purposes)
  getStorageIconName(storageType: CloudStorageType): string {
    switch (storageType) {
      case 'dropbox':
        return 'dropbox';
      case 'googledrive':
        return 'google-drive';
      case 'onedrive':
        return 'microsoft';
      default:
        return 'cloud';
    }
  }
}

// Export singleton instance
export const cloudStorageManager = new CloudStorageManager();
export default cloudStorageManager;