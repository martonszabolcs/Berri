/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SocialAuthController } from '../social-auth.controller';
import { AuthService } from '../../services/auth.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { FacebookAuthService } from '../../services/facebook-auth.service';
import { AppleAuthService } from '../../services/apple-auth.service';
import { SocialLoginDto } from '../../dto/auth.dto';

describe('SocialAuthController', () => {
  let controller: SocialAuthController;
  let authService: AuthService;
  let googleAuthService: GoogleAuthService;
  let facebookAuthService: FacebookAuthService;
  let appleAuthService: AppleAuthService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSocialUser = {
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockSocialAuthResult = {
    access_token: 'jwt-token',
    user: mockUser,
  };

  const mockAuthService = {
    socialLogin: jest.fn(),
  };

  const mockGoogleAuthService = {
    validateToken: jest.fn(),
  };

  const mockFacebookAuthService = {
    validateToken: jest.fn(),
  };

  const mockAppleAuthService = {
    validateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialAuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: GoogleAuthService,
          useValue: mockGoogleAuthService,
        },
        {
          provide: FacebookAuthService,
          useValue: mockFacebookAuthService,
        },
        {
          provide: AppleAuthService,
          useValue: mockAppleAuthService,
        },
      ],
    }).compile();

    controller = module.get<SocialAuthController>(SocialAuthController);
    authService = module.get<AuthService>(AuthService);
    googleAuthService = module.get<GoogleAuthService>(GoogleAuthService);
    facebookAuthService = module.get<FacebookAuthService>(FacebookAuthService);
    appleAuthService = module.get<AppleAuthService>(AppleAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleLogin', () => {
    it('should authenticate with Google successfully', async () => {
      const socialLoginDto: SocialLoginDto = {
        accessToken: 'google-access-token',
        platform: 'android',
      };

      mockGoogleAuthService.validateToken.mockResolvedValue(mockSocialUser);
      mockAuthService.socialLogin.mockResolvedValue(mockSocialAuthResult);

      const result = await controller.googleLogin(socialLoginDto);

      expect(googleAuthService.validateToken).toHaveBeenCalledWith(
        socialLoginDto.accessToken,
        socialLoginDto.platform,
      );
      expect(authService.socialLogin).toHaveBeenCalledWith(
        mockSocialUser.email,
        mockSocialUser.name,
        false,
      );
      expect(result).toEqual(mockSocialAuthResult);
    });

    it('should handle Google authentication error', async () => {
      const socialLoginDto: SocialLoginDto = {
        accessToken: 'invalid-token',
      };

      mockGoogleAuthService.validateToken.mockRejectedValue(
        new Error('Invalid Google token'),
      );

      await expect(controller.googleLogin(socialLoginDto)).rejects.toThrow(
        'Invalid Google token',
      );
      expect(googleAuthService.validateToken).toHaveBeenCalledWith(
        socialLoginDto.accessToken,
        undefined,
      );
    });
  });

  describe('facebookLogin', () => {
    it('should authenticate with Facebook successfully', async () => {
      const socialLoginDto: SocialLoginDto = {
        accessToken: 'facebook-access-token',
        platform: 'ios',
      };

      mockFacebookAuthService.validateToken.mockResolvedValue(mockSocialUser);
      mockAuthService.socialLogin.mockResolvedValue(mockSocialAuthResult);

      const result = await controller.facebookLogin(socialLoginDto);

      expect(facebookAuthService.validateToken).toHaveBeenCalledWith(
        socialLoginDto.accessToken,
      );
      expect(authService.socialLogin).toHaveBeenCalledWith(
        mockSocialUser.email,
        mockSocialUser.name,
        false,
      );
      expect(result).toEqual(mockSocialAuthResult);
    });

    it('should handle Facebook authentication error', async () => {
      const socialLoginDto: SocialLoginDto = {
        accessToken: 'invalid-token',
      };

      mockFacebookAuthService.validateToken.mockRejectedValue(
        new Error('Invalid Facebook token'),
      );

      await expect(controller.facebookLogin(socialLoginDto)).rejects.toThrow(
        'Invalid Facebook token',
      );
      expect(facebookAuthService.validateToken).toHaveBeenCalledWith(
        socialLoginDto.accessToken,
      );
    });
  });

  describe('appleLogin', () => {
    it('should authenticate with Apple successfully', async () => {
      const socialLoginDto: SocialLoginDto = {
        accessToken: 'apple-identity-token',
        nonce: 'apple-nonce',
      };

      mockAppleAuthService.validateToken.mockResolvedValue(mockSocialUser);
      mockAuthService.socialLogin.mockResolvedValue(mockSocialAuthResult);

      const result = await controller.appleLogin(socialLoginDto);

      expect(appleAuthService.validateToken).toHaveBeenCalledWith(
        socialLoginDto.accessToken,
        socialLoginDto.nonce,
      );
      expect(authService.socialLogin).toHaveBeenCalledWith(
        mockSocialUser.email,
        mockSocialUser.name,
        false,
      );
      expect(result).toEqual(mockSocialAuthResult);
    });

    it('should handle Apple authentication error', async () => {
      const socialLoginDto: SocialLoginDto = {
        accessToken: 'invalid-token',
      };

      mockAppleAuthService.validateToken.mockRejectedValue(
        new Error('Invalid Apple token'),
      );

      await expect(controller.appleLogin(socialLoginDto)).rejects.toThrow(
        'Invalid Apple token',
      );
      expect(appleAuthService.validateToken).toHaveBeenCalledWith(
        socialLoginDto.accessToken,
        undefined,
      );
    });
  });
});
