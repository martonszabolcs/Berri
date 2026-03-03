import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { uploadFileAndSendToRecipients } from './api/sendFilesApi';

export interface UploadProgress {
  progress: number; // 0-100
  fileName: string;
  fileSize?: number;
}

export interface UploadResult {
  message: string;
  sentTo: string[];
}

interface UploadState {
  isUploading: boolean;
  uploadProgress: UploadProgress | null;
  lastUploadResult: UploadResult | null;
  error: string | null;
}

const initialState: UploadState = {
  isUploading: false,
  uploadProgress: null,
  lastUploadResult: null,
  error: null,
};

// Async thunk for uploading and sending files
export const uploadAndSendFile = createAsyncThunk(
  'upload/uploadAndSendFile',
  async (
    { type, file, user }: { type: number; file: File | any; user: any },
    { dispatch, rejectWithValue }
  ) => {
    try {
      console.log('🚀 uploadSlice: uploadAndSendFile thunk started', {
        type,
        fileName: file?.name || file?.fileName || 'unknown'
      });

      // Set initial upload progress
      dispatch(setUploadProgress({
        progress: 0,
        fileName: file?.name || file?.fileName || 'unknown',
        fileSize: file?.size
      }));

      // Simulate progress updates (in real implementation, this would come from axios progress)
      // const progressInterval = setInterval(() => {
      //   dispatch(updateProgress(Math.min(90, Math.random() * 80 + 10)));
      // }, 200);

      //check if user has this type destination, if no create email with recipient user email
      const userDestinations = user.destinations || [];
      const hasTypeDestination = userDestinations.some(
        (dest: any) => dest.type === type
      );

      console.log("Userdestinations", userDestinations);
      console.log(`🔍 Checking for existing destination of type ${type}:`, hasTypeDestination);
      
      if (!hasTypeDestination) {
        console.log(`📧 User has no destination of type ${type}, creating email destination with user email`);
        const userEmail = user.email;
        if (userEmail) {
          // Use the same API as ChangeDestinationScreen
          const { updateDestinationSettings } = await import('./api/userApiService');
          const success = await updateDestinationSettings(type.toString(), {
            destination: 'email',
            emails: userEmail,
          });
          
          if (success) {
            console.log('✅ Email destination created successfully');
            // Refresh user data to get updated destinations
            const { refreshUser } = await import('./appSlice');
            await dispatch(refreshUser());
          } else {
            console.error('❌ Failed to create email destination');
          }
        }
      }

      // Upload the file
      const result = await uploadFileAndSendToRecipients(type, file);

      // Clear progress interval
      // clearInterval(progressInterval);

      if (result) {
        console.log('✅ uploadSlice: File uploaded successfully', result);
        
        // Set final progress
        dispatch(setUploadProgress({
          progress: 100,
          fileName: file?.name || file?.fileName || 'unknown',
          fileSize: file?.size
        }));

        // Clear progress after a short delay
        setTimeout(() => {
          dispatch(clearUploadProgress());
        }, 1500);

        return result;
      } else {
        throw new Error('Upload failed - no response from server');
      }
    } catch (error: any) {
      console.error('❌ uploadSlice: uploadAndSendFile failed', error);
      
      // Clear any progress on error
      dispatch(clearUploadProgress());
      
      const errorMessage = error.response?.data?.message || error.message || 'Upload failed';
      return rejectWithValue(errorMessage);
    }
  }
);

const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    setUploadProgress: (state, action: PayloadAction<UploadProgress>) => {
      state.uploadProgress = action.payload;
      state.error = null;
    },
    // updateProgress: (state, action: PayloadAction<number>) => {
    //   if (state.uploadProgress) {
    //     state.uploadProgress.progress = Math.min(100, action.payload);
    //   }
    // },
    clearUploadProgress: (state) => {
      state.uploadProgress = null;
    },
    clearUploadResult: (state) => {
      state.lastUploadResult = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isUploading = false;
      state.uploadProgress = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetUploadState: (_state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      // Upload and Send File
      .addCase(uploadAndSendFile.pending, (state) => {
        state.isUploading = true;
        state.error = null;
        state.lastUploadResult = null;
      })
      .addCase(uploadAndSendFile.fulfilled, (state, action) => {
        state.isUploading = false;
        state.lastUploadResult = action.payload;
        state.error = null;
      })
      .addCase(uploadAndSendFile.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload as string || 'Upload failed';
        state.uploadProgress = null;
      });
  },
});

export const { 
  setUploadProgress,
  //updateProgress,
  clearUploadProgress,
  clearUploadResult,
  setError,
  clearError,
  resetUploadState
} = uploadSlice.actions;

export default uploadSlice.reducer;