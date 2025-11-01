import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  currentScreen: string;
  isLoading: boolean;
  token: string | null;
  isAuthenticated: boolean;
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    emailVerified: boolean | null;
  };
  error: string | null;
}

const initialState: AppState = {
  currentScreen: 'Home',
  isLoading: false,
  token: null,
  isAuthenticated: false,
  user: {
    id: null,
    name: null,
    email: null,
    emailVerified: null,
  },
  error: null,
};

// Async thunks for auth operations
export const initializeAuth = createAsyncThunk(
  'app/initializeAuth',
  async (_, { dispatch }) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        dispatch(setToken(token));
        return token;
      }
      return null;
    } catch (error) {
      console.error('Error initializing auth:', error);
      await AsyncStorage.removeItem('authToken');
      return null;
    }
  }
);

export const loginUser = createAsyncThunk(
  'app/loginUser',
  async ({ access_token, user }: { access_token: string; user: any }, { dispatch }) => {
    try {
      // Store token in AsyncStorage
      await AsyncStorage.setItem('authToken', access_token);
      
      // Set token and user in Redux
      dispatch(setToken(access_token));
      dispatch(setUser({
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified || false,
      }));
      
      return { access_token, user };
    } catch (error) {
      console.error('Error storing login data:', error);
      throw error;
    }
  }
);

export const logoutUser = createAsyncThunk(
  'app/logoutUser',
  async (_, { dispatch }) => {
    try {
      // Remove token from AsyncStorage
      await AsyncStorage.removeItem('authToken');
      
      // Clear Redux state
      dispatch(logout());
      
      return true;
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if AsyncStorage fails, clear Redux state
      dispatch(logout());
      return true;
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
          state.token = action.payload;
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
      .addCase(loginUser.fulfilled, (state) => {
        state.isLoading = false;
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
      });
  },
});

export const { 
  setCurrentScreen, 
  setLoading, 
  setToken, 
  clearToken, 
  setUser, 
  clearUser, 
  setError,
  clearError,
  logout 
} = appSlice.actions;
export default appSlice.reducer;