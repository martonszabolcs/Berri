import { useAppSelector, useAppDispatch } from '../store/hooks';
import { logoutUser } from '../store/appSlice';
import { authApi } from '../store/api/authApi';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { token, isAuthenticated, user, isLoading, error } = useAppSelector((state) => state.app);

  const login = async (email: string, password: string) => {
    try {
      await authApi.login({ email, password });
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed';
      return { success: false, error: message };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      await authApi.register({ name, email, password });
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Registration failed';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await dispatch(logoutUser());
      return { success: true };
    } catch (err: any) {
      console.error('Logout error:', err);
      return { success: false, error: 'Logout failed' };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      await authApi.forgotPassword({ email });
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Password reset request failed';
      return { success: false, error: message };
    }
  };

  const resetPassword = async (resetToken: string, password: string) => {
    try {
      await authApi.resetPassword({ token: resetToken, password });
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Password reset failed';
      return { success: false, error: message };
    }
  };

  const verifyEmail = async (verificationToken: string) => {
    try {
      await authApi.verifyEmail({ token: verificationToken });
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Email verification failed';
      return { success: false, error: message };
    }
  };

  const googleLogin = async (accessToken: string) => {
    try {
      await authApi.googleLogin({ accessToken });
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Google login failed';
      return { success: false, error: message };
    }
  };

  const facebookLogin = async (accessToken: string) => {
    try {
      await authApi.facebookLogin({ accessToken });
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Facebook login failed';
      return { success: false, error: message };
    }
  };

  const appleLogin = async (accessToken: string, nonce?: string) => {
    try {
      await authApi.appleLogin({ accessToken, nonce });
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Apple login failed';
      return { success: false, error: message };
    }
  };

  return {
    // State
    token,
    isAuthenticated,
    user,
    isLoading,
    error,
    
    // Actions
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    googleLogin,
    facebookLogin,
    appleLogin,
  };
};