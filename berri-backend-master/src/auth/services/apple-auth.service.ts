import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SocialAuthProvider, SocialUser } from '../interfaces/auth.interface';
import * as crypto from 'crypto';
import appleSigninAuth from 'apple-signin-auth';

@Injectable()
export class AppleAuthService implements SocialAuthProvider {
  async validateToken(token: string, nonce?: string): Promise<SocialUser> {
    try {
      const payload = await appleSigninAuth.verifyIdToken(token, {
        /** sha256 hex hash of raw nonce */
        nonce: nonce
          ? crypto.createHash('sha256').update(nonce).digest('hex')
          : undefined,
      });

      if (!payload || !payload.email) {
        throw new HttpException('Invalid Apple token', HttpStatus.BAD_REQUEST);
      }

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.email.split('@')[0], // Apple doesn't always provide name
        provider: 'apple',
      };
    } catch (error) {
      console.error('Apple login error:', error);
      throw new HttpException(
        'Apple login failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
