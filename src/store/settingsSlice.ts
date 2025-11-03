import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from './api/authApi';
import { updateCloudStorageTokens } from './api/userApiService';

export interface CloudConnectionStatus {
  googleDrive: boolean;
  oneDrive: boolean;
  dropbox: boolean;
}

interface SettingsState {
  isLoading: boolean;
  connectionStatus: CloudConnectionStatus;
  error: string | null;
}

const initialState: SettingsState = {
  isLoading: false,
  connectionStatus: {
    googleDrive: false,
    oneDrive: false,
    dropbox: false,
  },
  error: null,
};

// Async thunks for cloud storage operations
export const saveDropboxToken = createAsyncThunk(
  'settings/saveDropboxToken',
  async (tokens: { accessToken: string; refreshToken?: string }, { dispatch }) => {
    try {
      console.log('🚀 settingsSlice: saveDropboxToken thunk started');
      
      // Update the tokens in the backend
      const success = await updateCloudStorageTokens('dropbox', tokens);
      
      if (success) {
        console.log('✅ settingsSlice: Dropbox tokens saved successfully');
        
        // Update the connection status
        dispatch(updateConnectionStatus({ provider: 'dropbox', connected: true }));
        
        // Refresh full connection status to sync with backend
        await dispatch(refreshConnectionStatus());
        
        return tokens;
      } else {
        throw new Error('Failed to save Dropbox tokens');
      }
    } catch (error) {
      console.error('❌ settingsSlice: saveDropboxToken failed', error);
      throw error;
    }
  }
);

export const refreshConnectionStatus = createAsyncThunk(
  'settings/refreshConnectionStatus',
  async (_, { dispatch }) => {
    try {
      console.log('🚀 settingsSlice: refreshConnectionStatus thunk started');
      const user = await authApi.getMe();
      console.log('✅ settingsSlice: User data fetched', user);
      
      const status: CloudConnectionStatus = {
        googleDrive: !!user.googleDriveAccessToken,
        oneDrive: !!user.oneDriveAccessToken,
        dropbox: !!user.dropboxAccessToken,
      };
      
      console.log('📊 settingsSlice: Connection status', status);
      dispatch(setConnectionStatus(status));
      
      return status;
    } catch (error) {
      console.error('❌ settingsSlice: refreshConnectionStatus failed', error);
      throw error;
    }
  }
);

export const connectCloudStorage = createAsyncThunk(
  'settings/connectCloudStorage',
  async (provider: 'googleDrive' | 'oneDrive' | 'dropbox', { dispatch }) => {
    try {
      console.log('🚀 settingsSlice: connectCloudStorage thunk started', provider);
      
      // TODO: Implement actual cloud storage connection logic
      // This would typically involve OAuth flows
      
      // For now, simulate a connection
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      
      // Refresh status after connection
      await dispatch(refreshConnectionStatus());
      
      console.log('✅ settingsSlice: connectCloudStorage completed', provider);
      return provider;
    } catch (error) {
      console.error('❌ settingsSlice: connectCloudStorage failed', error);
      throw error;
    }
  }
);

export const disconnectCloudStorage = createAsyncThunk(
  'settings/disconnectCloudStorage',
  async (provider: 'googleDrive' | 'oneDrive' | 'dropbox', { dispatch }) => {
    try {
      console.log('🚀 settingsSlice: disconnectCloudStorage thunk started', provider);
      
      // TODO: Implement actual cloud storage disconnection logic
      
      // For now, simulate a disconnection
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      
      // Update local status
      dispatch(updateConnectionStatus({ provider, connected: false }));
      
      console.log('✅ settingsSlice: disconnectCloudStorage completed', provider);
      return provider;
    } catch (error) {
      console.error('❌ settingsSlice: disconnectCloudStorage failed', error);
      throw error;
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<CloudConnectionStatus>) => {
      state.connectionStatus = action.payload;
      state.error = null;
    },
    updateConnectionStatus: (state, action: PayloadAction<{ provider: keyof CloudConnectionStatus; connected: boolean }>) => {
      state.connectionStatus[action.payload.provider] = action.payload.connected;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Save Dropbox Token
      .addCase(saveDropboxToken.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveDropboxToken.fulfilled, (state) => {
        state.isLoading = false;
        // Connection status is updated via the updateConnectionStatus dispatch
      })
      .addCase(saveDropboxToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to save Dropbox token';
      })
      
      // Refresh Connection Status
      .addCase(refreshConnectionStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(refreshConnectionStatus.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(refreshConnectionStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to refresh connection status';
      })
      
      // Connect Cloud Storage
      .addCase(connectCloudStorage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(connectCloudStorage.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(connectCloudStorage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to connect cloud storage';
      })
      
      // Disconnect Cloud Storage
      .addCase(disconnectCloudStorage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(disconnectCloudStorage.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(disconnectCloudStorage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to disconnect cloud storage';
      });
  },
});

export const { 
  setConnectionStatus,
  updateConnectionStatus,
  setError,
  clearError,
  setLoading
} = settingsSlice.actions;

export default settingsSlice.reducer;