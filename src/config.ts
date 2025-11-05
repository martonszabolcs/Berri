// API Configuration
export const API_CONFIG = {
  // TODO: Update with actual backend URL
  BASE_URL: __DEV__ ? 'http://192.168.1.65:3000' : 'https://api.yourdomain.com',
  TIMEOUT: 10000,
};

// Legacy export for backward compatibility
export const BACKEND_URL = API_CONFIG.BASE_URL;
