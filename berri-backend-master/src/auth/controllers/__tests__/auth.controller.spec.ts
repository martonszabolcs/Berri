/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from '../auth.controller';
import { AuthService } from '../../services/auth.service';
import { UsersService } from '../../../users/users.service';
import { EmailService } from '../../../core/email/email.service';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from '../../dto/auth.dto';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { LocalAuthGuard } from '../../guards/local-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    googleDriveLink: '',
    oneDriveLink: '',
    dropboxLink: '',
    dropboxAccessToken: '',
    oneDriveAccessToken: '',
    googleDriveAccessToken: '',
    emailVerified: false,
    emailVerificationToken: 'verification-token',
    resetPasswordToken: null,
    resetPasswordExpires: null,
    newsletter: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    destinations: [],
    settings: {
      id: 1,
      userId: 1,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: null as any, // Circular reference, skip in test
      dropboxEnabled: true,
      oneDriveEnabled: true,
      googleDriveEnabled: true,
      emailEnabled: false,
      dropboxAccessToken: '',
      dropboxRefreshToken: '',
      dropboxTokenExpiresAt: new Date(),
      dropboxFolderPath: '',
      oneDriveAccessToken: '',
      oneDriveRefreshToken: '',
      oneDriveTokenExpiresAt: new Date(),
      oneDriveFolderPath: '',
      googleDriveAccessToken: '',
      googleDriveRefreshToken: '',
      googleDriveTokenExpiresAt: new Date(),
      googleDriveFolderName: '',
      emailRecipient: '',
      emailSubject: '',
      emailMessage: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
    forgottenPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockEmailService = {
    sendEmailVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendPasswordResetConfirmation: jest.fn(),
    testEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(LocalAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const expectedResult = {
        message: 'User registered successfully',
        user: mockUser,
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(createUserDto);

      expect(authService.register).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw error if user already exists', async () => {
      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
      };

      mockAuthService.register.mockRejectedValue(
        new Error('User with this email already exists'),
      );

      await expect(controller.register(createUserDto)).rejects.toThrow(
        'User with this email already exists',
      );
      expect(authService.register).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('login', () => {
    it('should login user successfully', () => {
      const mockRequest = {
        user: mockUser,
      };

      const expectedResult = {
        access_token: 'jwt-token',
        user: mockUser,
      };

      mockAuthService.login.mockReturnValue(expectedResult);

      const result = controller.login(mockRequest as any);

      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('forgottenPassword', () => {
    it('should send password reset email successfully', async () => {
      const forgotPasswordDto: ForgotPasswordDto = {
        email: 'test@example.com',
      };

      const expectedResult = {
        message: 'Password reset email sent',
      };

      mockAuthService.forgottenPassword.mockResolvedValue(expectedResult);

      const result = await controller.forgottenPassword(forgotPasswordDto);

      expect(authService.forgottenPassword).toHaveBeenCalledWith(
        forgotPasswordDto.email,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle non-existent email gracefully', async () => {
      const forgotPasswordDto: ForgotPasswordDto = {
        email: 'nonexistent@example.com',
      };

      const expectedResult = {
        message: 'Password reset email sent',
      };

      mockAuthService.forgottenPassword.mockResolvedValue(expectedResult);

      const result = await controller.forgottenPassword(forgotPasswordDto);

      expect(authService.forgottenPassword).toHaveBeenCalledWith(
        forgotPasswordDto.email,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const resetPasswordDto: ResetPasswordDto = {
        token: 'reset-token',
        password: 'newpassword123',
      };

      const expectedResult = {
        message: 'Password reset successfully',
      };

      mockAuthService.resetPassword.mockResolvedValue(expectedResult);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(authService.resetPassword).toHaveBeenCalledWith(
        resetPasswordDto.token,
        resetPasswordDto.password,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid token', async () => {
      const resetPasswordDto: ResetPasswordDto = {
        token: 'invalid-token',
        password: 'newpassword123',
      };

      mockAuthService.resetPassword.mockRejectedValue(
        new Error('Invalid or expired token'),
      );

      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow(
        'Invalid or expired token',
      );
      expect(authService.resetPassword).toHaveBeenCalledWith(
        resetPasswordDto.token,
        resetPasswordDto.password,
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const verifyEmailDto: VerifyEmailDto = {
        token: 'verification-token',
      };

      const expectedResult = {
        message: 'Email verified successfully',
      };

      mockAuthService.verifyEmail.mockResolvedValue(expectedResult);

      const result = await controller.verifyEmail(verifyEmailDto);

      expect(authService.verifyEmail).toHaveBeenCalledWith(
        verifyEmailDto.token,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid verification token', async () => {
      const verifyEmailDto: VerifyEmailDto = {
        token: 'invalid-token',
      };

      mockAuthService.verifyEmail.mockRejectedValue(
        new Error('Invalid verification token'),
      );

      await expect(controller.verifyEmail(verifyEmailDto)).rejects.toThrow(
        'Invalid verification token',
      );
      expect(authService.verifyEmail).toHaveBeenCalledWith(
        verifyEmailDto.token,
      );
    });
  });
});
