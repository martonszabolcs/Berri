/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialAuthProvider, SocialUser } from '../interfaces/auth.interface';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { OAuth2Client } = require('google-auth-library');

@Injectable()
export class GoogleAuthService implements SocialAuthProvider {
  private readonly googleClient: string;
  private readonly androidGoogleClient: string;

  constructor(private readonly configService: ConfigService) {
    this.googleClient =
      this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.androidGoogleClient =
      this.configService.get<string>('ANDROID_GOOGLE_CLIENT_ID') || '';
  }

  async validateToken(token: string, platform?: string): Promise<SocialUser> {
    try {
      const client =
        platform === 'android'
          ? new OAuth2Client(this.androidGoogleClient)
          : new OAuth2Client(this.googleClient);

      const ticket = await client.verifyIdToken({
        idToken: token,
      });

      const googleUser = ticket.getPayload();

      if (!googleUser || !googleUser.email) {
        throw new HttpException('Invalid Google token', HttpStatus.BAD_REQUEST);
      }

      return {
        id: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        picture: googleUser.picture,
        provider: 'google',
      };
    } catch (error) {
      console.error('Google login error:', error);
      throw new HttpException(
        'Google login failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
