/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    googleDriveLink: null,
    oneDriveLink: null,
    dropboxLink: null,
    dropboxAccessToken: null,
    oneDriveAccessToken: null,
    googleDriveAccessToken: null,
    emailVerified: false,
    emailVerificationToken: null,
    resetPasswordToken: null,
    resetPasswordExpires: null,
    newsletter: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    updateUser: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: 2, email: 'test2@example.com' },
      ];

      mockUsersService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.findAll();

      expect(usersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should handle service errors', async () => {
      mockUsersService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll()).rejects.toThrow('Database error');
      expect(usersService.findAll).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return current user profile', async () => {
      const mockRequest = {
        user: { sub: 1 },
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getProfile(mockRequest);

      expect(usersService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found', async () => {
      const mockRequest = {
        user: { sub: 999 },
      };

      mockUsersService.findOne.mockResolvedValue(null);

      const result = await controller.getProfile(mockRequest);

      expect(usersService.findOne).toHaveBeenCalledWith(999);
      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(1);

      expect(usersService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      const result = await controller.findOne(999);

      expect(usersService.findOne).toHaveBeenCalledWith(999);
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto: UpdateUserDto = {
        name: 'Updated User',
        googleDriveLink: 'https://drive.google.com/updated',
      };

      const updatedUser = { ...mockUser, ...updateUserDto };
      mockUsersService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.update(1, updateUserDto);

      expect(usersService.updateUser).toHaveBeenCalledWith(1, updateUserDto);
      expect(result).toEqual(updatedUser);
    });

    it('should handle user not found during update', async () => {
      const updateUserDto: UpdateUserDto = {
        name: 'Updated User',
      };

      mockUsersService.updateUser.mockRejectedValue(
        new Error('User not found'),
      );

      await expect(controller.update(999, updateUserDto)).rejects.toThrow(
        'User not found',
      );
      expect(usersService.updateUser).toHaveBeenCalledWith(999, updateUserDto);
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      mockUsersService.delete.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(usersService.delete).toHaveBeenCalledWith(1);
    });

    it('should handle user not found during deletion', async () => {
      mockUsersService.delete.mockRejectedValue(new Error('User not found'));

      await expect(controller.remove(999)).rejects.toThrow('User not found');
      expect(usersService.delete).toHaveBeenCalledWith(999);
    });
  });
});
