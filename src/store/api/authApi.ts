import axios, { AxiosResponse } from 'axios';
import { store } from '../index';
import { loginUser, logoutUser, setError } from '../appSlice';
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
      store.dispatch(logoutUser());
    }
    return Promise.reject(error);
  }
);

// Auth API functions with Redux integration
export const authApi = {
  // Login
  login: async (loginData: LoginDto): Promise<LoginResponse> => {
    try {
      const response: AxiosResponse<LoginResponse> = await apiClient.post('/auth/login', loginData);
      
      // Use Redux thunk to handle login
      await store.dispatch(loginUser({
        access_token: response.data.access_token,
        user: response.data.user
      }));
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
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
      
      // Use Redux thunk to handle login
      await store.dispatch(loginUser({
        access_token: response.data.access_token,
        user: response.data.user
      }));
      
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
      
      // Use Redux thunk to handle login
      await store.dispatch(loginUser({
        access_token: response.data.access_token,
        user: response.data.user
      }));
      
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
      
      // Use Redux thunk to handle login
      await store.dispatch(loginUser({
        access_token: response.data.access_token,
        user: response.data.user
      }));
      
      return response.data;
    } catch (error) {
      console.error('Apple login error:', error);
      store.dispatch(setError('Apple login failed'));
      throw error;
    }
  },

  // Get current user
  getMe: async (): Promise<User> => {
    try {
      const response: AxiosResponse<User> = await apiClient.get('/users/me');
      return response.data;
    } catch (error) {
      console.error('Get me error:', error);
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