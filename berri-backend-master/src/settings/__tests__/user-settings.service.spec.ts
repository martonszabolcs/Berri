import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserSettingsService } from '../user-settings.service';
import { UserSettings } from '../entities/user-settings.entity';
import { UpdateUserSettingsDto } from '../dto/update-user-settings.dto';

describe('UserSettingsService', () => {
  let service: UserSettingsService;
  let repository: any;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSettingsService,
        {
          provide: getRepositoryToken(UserSettings),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserSettingsService>(UserSettingsService);
    repository = module.get(getRepositoryToken(UserSettings));
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUserId', () => {
    it('should return user settings when found', async () => {
      const userId = 1;
      const mockSettings = {
        id: 1,
        userId,
        dropboxFolderPath: '/Scanned Documents',
        oneDriveFolderPath: 'Scanned Documents',
      };

      repository.findOne.mockResolvedValue(mockSettings);

      const result = await service.findByUserId(userId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual(mockSettings);
    });

    it('should create default settings when not found', async () => {
      const userId = 1;
      const defaultSettings = {
        id: 1,
        userId,
        dropboxFolderPath: '/Scanned Documents',
        oneDriveFolderPath: 'Scanned Documents',
        googleDriveFolderName: 'Scanned Documents',
        fileNaming: '{timestamp}_{originalname}',
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(defaultSettings);
      repository.save.mockResolvedValue(defaultSettings);

      const result = await service.findByUserId(userId);

      expect(repository.create).toHaveBeenCalledWith({
        userId,
        dropboxFolderPath: '/Scanned Documents',
        oneDriveFolderPath: 'Scanned Documents',
        googleDriveFolderName: 'Scanned Documents',
        fileNaming: '{timestamp}_{originalname}',
      });
      expect(result).toEqual(defaultSettings);
    });
  });

  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      const userId = 1;
      const updateDto: UpdateUserSettingsDto = {
        dropboxFolderPath: '/New Path',
        fileNaming: 'new_naming_pattern',
      };

      const existingSettings = {
        id: 1,
        userId,
        dropboxFolderPath: '/Old Path',
        fileNaming: 'old_pattern',
      };

      const updatedSettings = {
        ...existingSettings,
        ...updateDto,
      };

      repository.findOne.mockResolvedValue(existingSettings);
      repository.save.mockResolvedValue(updatedSettings);

      const result = await service.updateSettings(userId, updateDto);

      expect(repository.save).toHaveBeenCalledWith({
        ...existingSettings,
        ...updateDto,
      });
      expect(result).toEqual(updatedSettings);
    });

    it('should create new settings if not found', async () => {
      const userId = 1;
      const updateDto: UpdateUserSettingsDto = {
        dropboxFolderPath: '/New Path',
      };

      const defaultSettings = {
        id: 1,
        userId,
        dropboxFolderPath: '/Scanned Documents',
        oneDriveFolderPath: 'Scanned Documents',
        googleDriveFolderName: 'Scanned Documents',
        fileNaming: '{timestamp}_{originalname}',
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(defaultSettings);
      repository.save.mockResolvedValue(defaultSettings);

      await service.updateSettings(userId, updateDto);

      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('updateTokens', () => {
    it('should update token data', async () => {
      const userId = 1;
      const tokenData = {
        dropboxAccessToken: 'new_access_token',
        dropboxTokenExpiresAt: new Date(),
      };

      const existingSettings = {
        id: 1,
        userId,
        dropboxAccessToken: 'old_token',
      };

      const updatedSettings = {
        ...existingSettings,
        ...tokenData,
      };

      repository.findOne.mockResolvedValue(existingSettings);
      repository.save.mockResolvedValue(updatedSettings);

      const result = await service.updateTokens(userId, tokenData);

      expect(result).toEqual(updatedSettings);
    });
  });
});