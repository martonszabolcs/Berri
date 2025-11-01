import { useState, useEffect } from 'react';
import cloudStorageManager, { CloudStorageType, CloudStorageConnectionResult } from '../store/api/cloudStorageManager';

export interface UseCloudStorageResult {
  // Connection status
  connectionStatus: Record<CloudStorageType, boolean>;
  isLoading: boolean;
  
  // Actions
  connect: (storageType: CloudStorageType) => Promise<CloudStorageConnectionResult>;
  disconnect: (storageType: CloudStorageType) => Promise<boolean>;
  uploadFile: (storageType: CloudStorageType, fileUri: string, fileName: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  listFiles: (storageType: CloudStorageType) => Promise<{ success: boolean; files?: any[]; error?: string }>;
  getUserInfo: (storageType: CloudStorageType) => Promise<{ success: boolean; userInfo?: any; error?: string }>;
  
  // Utilities
  isConnected: (storageType: CloudStorageType) => boolean;
  getAvailableStorageTypes: () => Promise<CloudStorageType[]>;
  hasAnyConnection: () => Promise<boolean>;
  refreshConnectionStatus: () => Promise<void>;
}

export const useCloudStorage = (): UseCloudStorageResult => {
  const [connectionStatus, setConnectionStatus] = useState<Record<CloudStorageType, boolean>>({
    dropbox: false,
    googledrive: false,
    onedrive: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Refresh connection status
  const refreshConnectionStatus = async () => {
    try {
      setIsLoading(true);
      const status = await cloudStorageManager.getConnectionStatus();
      setConnectionStatus(status);
    } catch (error) {
      console.error('Error refreshing connection status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize connection status on mount
  useEffect(() => {
    refreshConnectionStatus();
  }, []);

  // Connect to a cloud storage service
  const connect = async (storageType: CloudStorageType): Promise<CloudStorageConnectionResult> => {
    try {
      setIsLoading(true);
      const result = await cloudStorageManager.connect(storageType);
      
      // Refresh status after connection attempt
      await refreshConnectionStatus();
      
      return result;
    } catch (error) {
      console.error(`Error connecting to ${storageType}:`, error);
      return {
        isConnected: false,
        storageType,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect from a cloud storage service
  const disconnect = async (storageType: CloudStorageType): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await cloudStorageManager.disconnect(storageType);
      
      // Refresh status after disconnection
      await refreshConnectionStatus();
      
      return result;
    } catch (error) {
      console.error(`Error disconnecting from ${storageType}:`, error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Upload file to cloud storage
  const uploadFile = async (
    storageType: CloudStorageType, 
    fileUri: string, 
    fileName: string
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    return cloudStorageManager.uploadFile(storageType, fileUri, fileName);
  };

  // List files from cloud storage
  const listFiles = async (
    storageType: CloudStorageType
  ): Promise<{ success: boolean; files?: any[]; error?: string }> => {
    return cloudStorageManager.listFiles(storageType);
  };

  // Get user info from cloud storage
  const getUserInfo = async (
    storageType: CloudStorageType
  ): Promise<{ success: boolean; userInfo?: any; error?: string }> => {
    return cloudStorageManager.getUserInfo(storageType);
  };

  // Check if a specific storage type is connected
  const isConnected = (storageType: CloudStorageType): boolean => {
    return connectionStatus[storageType] || false;
  };

  // Get available (connected) storage types
  const getAvailableStorageTypes = async (): Promise<CloudStorageType[]> => {
    return cloudStorageManager.getAvailableStorageTypes();
  };

  // Check if any storage is connected
  const hasAnyConnection = async (): Promise<boolean> => {
    return cloudStorageManager.hasAnyConnection();
  };

  return {
    // State
    connectionStatus,
    isLoading,
    
    // Actions
    connect,
    disconnect,
    uploadFile,
    listFiles,
    getUserInfo,
    
    // Utilities
    isConnected,
    getAvailableStorageTypes,
    hasAnyConnection,
    refreshConnectionStatus,
  };
};