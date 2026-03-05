import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../../users/users.service';
import { EmailService } from '../../core/email/email.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;

  const mockUsersService = {
    findOneByEmail: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
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
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data without password when credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const user = {
        id: 1,
        email,
        password: 'hashedPassword',
        name: 'Test User',
      };

      mockUsersService.findOneByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(email, password);

      expect(mockUsersService.findOneByEmail).toHaveBeenCalledWith(email);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, user.password);
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    });

    it('should return null when user not found', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      mockUsersService.findOneByEmail.mockResolvedValue(null);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const email = 'test@example.com';
      const password = 'wrongPassword';
      const user = {
        id: 1,
        email,
        password: 'hashedPassword',
        name: 'Test User',
      };

      mockUsersService.findOneByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('login', () => {
    it('should return access token for valid user', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      };
      const expectedToken = 'jwt-token';

      mockJwtService.sign.mockReturnValue(expectedToken);

      const result = service.login(user as any);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: user.email,
        sub: user.id,
      });
      expect(result).toEqual({
        access_token: expectedToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: undefined,
        },
      });
    });
  });
});