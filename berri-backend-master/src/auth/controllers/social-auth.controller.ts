import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { GoogleAuthService } from '../services/google-auth.service';
import { FacebookAuthService } from '../services/facebook-auth.service';
import { AppleAuthService } from '../services/apple-auth.service';
import { SocialLoginDto } from '../dto/auth.dto';
import { AuthTokens } from '../interfaces/auth.interface';

@ApiTags('auth')
@Controller('auth')
export class SocialAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly facebookAuthService: FacebookAuthService,
    private readonly appleAuthService: AppleAuthService,
  ) {}

  @Post('google')
  @ApiOperation({ summary: 'Google social login' })
  @ApiResponse({
    status: 200,
    description: 'Google login successful',
    schema: {
      properties: {
        access_token: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Google login failed' })
  async googleLogin(
    @Body(ValidationPipe) socialLoginDto: SocialLoginDto,
  ): Promise<AuthTokens> {
    const socialUser = await this.googleAuthService.validateToken(
      socialLoginDto.accessToken,
      socialLoginDto.platform,
    );

    return this.authService.socialLogin(socialUser.email, socialUser.name);
  }

  @Post('facebook')
  @ApiOperation({ summary: 'Facebook social login' })
  @ApiResponse({
    status: 200,
    description: 'Facebook login successful',
    schema: {
      properties: {
        access_token: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid Facebook token' })
  @ApiResponse({ status: 500, description: 'Facebook login failed' })
  async facebookLogin(
    @Body(ValidationPipe) socialLoginDto: SocialLoginDto,
  ): Promise<AuthTokens> {
    const socialUser = await this.facebookAuthService.validateToken(
      socialLoginDto.accessToken,
    );

    return this.authService.socialLogin(socialUser.email, socialUser.name);
  }

  @Post('apple')
  @ApiOperation({ summary: 'Apple social login' })
  @ApiResponse({
    status: 200,
    description: 'Apple login successful',
    schema: {
      properties: {
        access_token: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid Apple token' })
  @ApiResponse({ status: 500, description: 'Apple login failed' })
  async appleLogin(
    @Body(ValidationPipe) socialLoginDto: SocialLoginDto,
  ): Promise<AuthTokens> {
    const socialUser = await this.appleAuthService.validateToken(
      socialLoginDto.accessToken,
      socialLoginDto.nonce,
    );

    return this.authService.socialLogin(socialUser.email, socialUser.name);
  }
}
