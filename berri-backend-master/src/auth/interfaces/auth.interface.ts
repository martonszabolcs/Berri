export interface SocialUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  provider: 'google' | 'apple' | 'facebook';
}

export interface AuthTokens {
  access_token: string;
  user: {
    id: number;
    email: string;
    name: string;
    emailVerified: boolean;
  };
}

export interface SocialAuthProvider {
  validateToken(token: string, platform?: string): Promise<SocialUser>;
}

export interface AuthResponse {
  message: string;
  user?: any;
  access_token?: string;
}
