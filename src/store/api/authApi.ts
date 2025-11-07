import axios, { AxiosResponse } from 'axios';
import { store } from '../index';
import { logoutUser, setError } from '../appSlice';
import { API_CONFIG } from '../../config';

// Base URL configuration
const API_BASE_URL = API_CONFIG.BASE_URL;

// Types based on the Swagger spec
export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateUserDto {
  name?: string;
  email: string;
  password: string;
  googleDriveLink?: string;
  oneDriveLink?: string;
  dropboxLink?: string;
  newsletter?: boolean;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface VerifyEmailDto {
  token: string;
}

export interface SocialLoginDto {
  accessToken: string;
  platform?: string;
  newsletter?: boolean;
  nonce?: string;
}

export interface Destination {
  id: number;
  userId: number;
  type: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  fileType: 'pdf' | 'jpg';
  bundled: boolean;
  destination: 'email' | 'onedrive' | 'dropbox' | 'google_drive';
  emails?: string;
  createdAt: string;
  updatedAt: string;
  saved?: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  googleDriveLink: string;
  oneDriveLink: string;
  dropboxLink: string;
  dropboxAccessToken?: string;
  oneDriveAccessToken?: string;
  googleDriveAccessToken?: string;
  emailVerified: boolean;
  newsletter: boolean;
  createdAt: string;
  updatedAt: string;
  destinations?: Destination[];
  settings?: any;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
}

export interface ApiResponse {
  message: string;
}

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const state = store.getState();
    const token = state.app.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, logout user
      // store.dispatch(logoutUser());
    }
    return Promise.reject(error);
  }
);

// Auth API functions with Redux integration
export const authApi = {
  // Login
  login: async (loginData: LoginDto): Promise<LoginResponse> => {
    try {
      console.log('🚀 authApi: login started', loginData);
      const response: AxiosResponse<LoginResponse> = await apiClient.post('/auth/login', loginData);
      console.log('✅ authApi: login response', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ authApi: login error', error);
      store.dispatch(setError('Login failed'));
      throw error;
    }
  },

  // Register
  register: async (userData: CreateUserDto): Promise<RegisterResponse> => {
    try {
      const response: AxiosResponse<RegisterResponse> = await apiClient.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      console.error('Register error:', error);
      store.dispatch(setError('Registration failed'));
      throw error;
    }
  },

  // Forgot Password
  forgotPassword: async (data: ForgotPasswordDto): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse<ApiResponse> = await apiClient.post('/auth/forgot-password', data);
      return response.data;
    } catch (error) {
      console.error('Forgot password error:', error);
      store.dispatch(setError('Password reset request failed'));
      throw error;
    }
  },

  // Reset Password
  resetPassword: async (data: ResetPasswordDto): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse<ApiResponse> = await apiClient.post('/auth/reset-password', data);
      return response.data;
    } catch (error) {
      console.error('Reset password error:', error);
      store.dispatch(setError('Password reset failed'));
      throw error;
    }
  },

  // Verify Email
  verifyEmail: async (data: VerifyEmailDto): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse<ApiResponse> = await apiClient.post('/auth/verify-email', data);
      return response.data;
    } catch (error) {
      console.error('Verify email error:', error);
      store.dispatch(setError('Email verification failed'));
      throw error;
    }
  },

  // Social Logins
  googleLogin: async (data: SocialLoginDto): Promise<LoginResponse> => {
    try {
      const response: AxiosResponse<LoginResponse> = await apiClient.post('/auth/google', data);
      return response.data;
    } catch (error) {
      console.error('Google login error:', error);
      store.dispatch(setError('Google login failed'));
      throw error;
    }
  },

  facebookLogin: async (data: SocialLoginDto): Promise<LoginResponse> => {
    try {
      const response: AxiosResponse<LoginResponse> = await apiClient.post('/auth/facebook', data);
      return response.data;
    } catch (error) {
      console.error('Facebook login error:', error);
      store.dispatch(setError('Facebook login failed'));
      throw error;
    }
  },

  appleLogin: async (data: SocialLoginDto): Promise<LoginResponse> => {
    try {
      const response: AxiosResponse<LoginResponse> = await apiClient.post('/auth/apple', data);
      return response.data;
    } catch (error) {
      console.error('Apple login error:', error);
      store.dispatch(setError('Apple login failed'));
      throw error;
    }
  },

// Get current user
  getMe: async (token?: string): Promise<User> => {
    try {
      console.log('🚀 authApi: getMe started', { hasCustomToken: !!token });
      
      // Create custom config with token if provided
      const config = token ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : {};
      
      const userResponse = await apiClient.get('/users/me', config);
      console.log('✅ authApi: getMe response', userResponse.data);

      const user: User = {
        ...userResponse.data,
      };
      
      return user;
    } catch (error) {
      console.error('❌ authApi: getMe error', error);
      throw error;
    }
  },

  // Logout
  logout: async (): Promise<void> => {
    try {
      // Use Redux thunk to handle logout
      await store.dispatch(logoutUser());
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  // Test email
  testEmail: async (): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse<ApiResponse> = await apiClient.post('/auth/test-email');
      return response.data;
    } catch (error) {
      console.error('Test email error:', error);
      throw error;
    }
  },
};

export default authApi;