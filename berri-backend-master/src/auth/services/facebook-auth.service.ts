import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { SocialAuthProvider, SocialUser } from '../interfaces/auth.interface';

@Injectable()
export class FacebookAuthService implements SocialAuthProvider {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async validateToken(token: string): Promise<SocialUser> {
    if (!token) {
      throw new HttpException(
        'Access token is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Step 1: Verify token with Facebook
      const appId = this.configService.get<string>('FACEBOOK_APP_ID');
      const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');

      const tokenVerificationUrl = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;
      const tokenVerificationResponse =
        await this.httpService.axiosRef.get(tokenVerificationUrl);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data } = tokenVerificationResponse.data;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!data.is_valid) {
        throw new HttpException(
          'Invalid Facebook token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Step 2: Get user information
      const userResponse = await this.httpService.axiosRef.get(
        'https://graph.facebook.com/me',
        {
          params: {
            access_token: token,
            fields: 'id,email,first_name,last_name,picture',
          },
        },
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { id, email, first_name, last_name, picture } = userResponse.data;

      if (!email) {
        throw new HttpException(
          'Facebook account does not have an email',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        name: `${first_name} ${last_name}`.trim() || email.split('@')[0],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        picture: picture?.data?.url,
        provider: 'facebook',
      };
    } catch (error) {
      console.error('Facebook login error:', error);
      throw new HttpException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        error.response?.data || 'Error logging in with Facebook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
