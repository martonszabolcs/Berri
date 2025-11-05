import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Destination, authApi } from './api/authApi';

interface FileInfo {
  filename: string;
  url: string;
}

interface FileHistoryEntry {
  timestamp: number;
  destination: number;
  files: FileInfo[];
}

interface AppState {
  currentScreen: string;
  isLoading: boolean;
  token: string | null;
  isAuthenticated: boolean;
  user: any;
  destinations: Destination[];
  settings: any;
  history: FileHistoryEntry[];
  error: string | null;
}

const initialState: AppState = {
  currentScreen: 'Home',
  isLoading: false,
  token: null,
  isAuthenticated: false,
  user: {
    id: null,
    email: null,
  },
  destinations: [],
  settings: {},
  history: [],
  error: null,
};

const HISTORY_KEY = 'history';

// Async thunk to load history from AsyncStorage
export const loadHistory = createAsyncThunk(
  'app/loadHistory',
  async () => {
    try {
      const historyData = await AsyncStorage.getItem(HISTORY_KEY);
      if (historyData) {
        const history: FileHistoryEntry[] = JSON.parse(historyData);
        console.log('✅ appSlice: History loaded from AsyncStorage', history.length, 'entries');
        return history;
      }
      console.log('📝 appSlice: No history found in AsyncStorage');
      return [];
    } catch (error) {
      console.log('❌ appSlice: Failed to load history from AsyncStorage', error);
      return [];
    }
  }
);

// Async thunks for auth operations
export const initializeAuth = createAsyncThunk(
  'app/initializeAuth',
  async (_, { dispatch }) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      console.log('🚀 appSlice: initializeAuth thunk started, token found:', token);

      if (token) {
        const user = await authApi.getMe(token);
        
        // Set destinations in store if available
        if (user.destinations) {
          dispatch(setDestinations(user.destinations));
        }

        if (user.settings) {
          dispatch(setSettings(user.settings));
        }

        // Load history from AsyncStorage when user is authenticated
        dispatch(loadHistory());
        
        return { user, token };
      }
      
      return null;
    } catch (error) {
      console.log('❌ appSlice: initializeAuth failed', error);
      await AsyncStorage.removeItem('token');
      throw error;
    }
  }
);

export const loginUser = createAsyncThunk(
  'app/loginUser',
  async (credentials: { email: string; password: string }, { dispatch }) => {
    try {
      console.log('🚀 appSlice: loginUser thunk started', credentials);
      
      const response = await authApi.login(credentials);
      console.log('✅ appSlice: authApi.login successful', response);
      
      await AsyncStorage.setItem('token', response.access_token);
      console.log('✅ appSlice: Token saved to AsyncStorage');
      
      const user = await authApi.getMe(response.access_token);
      console.log('✅ appSlice: authApi.getMe successful', user);
      
      // Set destinations in store if available
      if (user.destinations) {
        console.log('📍 appSlice: Setting destinations', user.destinations);
        dispatch(setDestinations(user.destinations));
      }

      if (user.settings) {
        console.log('📍 appSlice: User settings found', user.settings);
        // Potentially dispatch an action to set user settings in another slice
        dispatch(setSettings(user.settings));
      }

      // Load history from AsyncStorage after successful login
      dispatch(loadHistory());

      console.log('✅ appSlice: loginUser thunk completed successfully');
      return { user, token: response.access_token };
    } catch (error) {
      console.error('❌ appSlice: loginUser thunk failed', error);
      throw error;
    }
  }
);

export const resetPassword = createAsyncThunk(
  'app/resetPassword',
  async ({ token, password }: { token: string; password: string }) => {
    try {
      console.log('🚀 appSlice: resetPassword thunk started');
      const response = await authApi.resetPassword({ token, password });
      console.log('✅ appSlice: resetPassword successful', response);
      return response;
    } catch (error) {
      console.error('❌ appSlice: resetPassword failed', error);
      throw error;
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'app/forgotPassword',
  async ({ email }: { email: string }) => {
    try {
      console.log('🚀 appSlice: forgotPassword thunk started', { email });
      const response = await authApi.forgotPassword({ email });
      console.log('✅ appSlice: forgotPassword successful', response);
      return response;
    } catch (error) {
      console.error('❌ appSlice: forgotPassword failed', error);
      throw error;
    }
  }
);

export const registerUser = createAsyncThunk(
  'app/registerUser',
  async (userData: { name?: string; email: string; password: string; googleDriveLink?: string; oneDriveLink?: string; dropboxLink?: string; newsletter?: boolean }) => {
    try {
      console.log('🚀 appSlice: registerUser thunk started', userData);
      const response = await authApi.register(userData);
      console.log('✅ appSlice: registerUser successful', response);
      return response;
    } catch (error) {
      console.error('❌ appSlice: registerUser failed', error);
      throw error;
    }
  }
);

export const logoutUser = createAsyncThunk(
  'app/logoutUser',
  async (_, { dispatch }) => {
    try {
      console.log('🚀 appSlice: logoutUser thunk started');
      // Remove token from AsyncStorage (correct key!)
      await AsyncStorage.removeItem('token');
      console.log('✅ appSlice: Token removed from AsyncStorage');
      
      // Clear Redux state
      dispatch(logout());
      console.log('✅ appSlice: logoutUser thunk completed');
      
      return true;
    } catch (error) {
      console.error('❌ appSlice: Error during logout:', error);
      // Even if AsyncStorage fails, clear Redux state
      dispatch(logout());
      return true;
    }
  }
);

export const refreshUser = createAsyncThunk(
  'app/refreshUser',
  async (_, { getState, rejectWithValue }) => {
    try {
      console.log('🚀 appSlice: refreshUser thunk started');
      const state = getState() as any;
      const token = state.app.token;
      
      if (!token) {
        throw new Error('No token available for refresh');
      }
      
      const user = await authApi.getMe(token);
      console.log('✅ appSlice: refreshUser successful', user);
      
      return user;
    } catch (error: any) {
      console.error('❌ appSlice: refreshUser failed', error);
      return rejectWithValue(error.message || 'Failed to refresh user data');
    }
  }
);

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setCurrentScreen: (state, action: PayloadAction<string>) => {
      state.currentScreen = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    clearToken: (state) => {
      state.token = null;
      state.isAuthenticated = false;
    },
    setUser: (state, action: PayloadAction<{ id: string; name: string; email: string; emailVerified?: boolean }>) => {
      state.user = {
        ...action.payload,
        emailVerified: action.payload.emailVerified ?? null,
      };
    },
    clearUser: (state) => {
      state.user = {
        id: null,
        name: null,
        email: null,
        emailVerified: null,
      };
    },
    setDestinations: (state, action: PayloadAction<Destination[]>) => {
      state.destinations = action.payload;
    },
    setSettings: (state, action: PayloadAction<any>) => {
      state.settings = action.payload;
    },
    clearDestinations: (state) => {
      state.destinations = [];
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    logout: (state) => {
      state.token = null;
      state.isAuthenticated = false;
      state.user = {
        id: null,
        name: null,
        email: null,
        emailVerified: null,
      };
      state.destinations = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize Auth
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.token = action.payload.token;
          state.user = {
            id: action.payload.user.id?.toString() || null,
            name: action.payload.user.name,
            email: action.payload.user.email,
            emailVerified: action.payload.user.emailVerified,
          };
          state.isAuthenticated = true;
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isLoading = false;
        state.token = null;
        state.isAuthenticated = false;
      })
      
      // Login User
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.user = {
          id: action.payload.user.id?.toString() || null,
          name: action.payload.user.name,
          email: action.payload.user.email,
          emailVerified: action.payload.user.emailVerified,
        };
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
      })
      
      // Logout User
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(logoutUser.rejected, (state) => {
        state.isLoading = false;
      })
      
      // Refresh User
      .addCase(refreshUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(refreshUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.destinations = action.payload.destinations || [];
        state.settings = action.payload.settings || {};
        state.error = null;
      })
      .addCase(refreshUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to refresh user data';
      })

      // Load History
      .addCase(loadHistory.fulfilled, (state, action) => {
        state.history = action.payload;
      })
  },
});

export const { 
  setCurrentScreen, 
  setLoading, 
  setToken, 
  clearToken, 
  setUser, 
  clearUser, 
  setDestinations,
  setSettings,
  clearDestinations,
  setError,
  clearError,
  logout 
} = appSlice.actions;
export default appSlice.reducer;