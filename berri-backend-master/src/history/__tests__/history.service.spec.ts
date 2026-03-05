import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HistoryService } from '../history.service';
import { FileHistory } from '../entities/file-history.entity';
import { CreateFileHistoryDto } from '../dto/file-history.dto';

describe('HistoryService', () => {
  let service: HistoryService;
  let repository: any;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        {
          provide: getRepositoryToken(FileHistory),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
    repository = module.get(getRepositoryToken(FileHistory));
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createHistoryEntry', () => {
    it('should create and save a history entry', async () => {
      const userId = 1;
      const createDto: CreateFileHistoryDto = {
        date: new Date('2024-01-01'),
        filename: 'test.pdf',
        url: 'https://example.com/file.pdf',
        provider: 'dropbox',
        fileSize: 1024,
        mimeType: 'application/pdf',
      };

      const expectedEntry = { id: 1, userId, ...createDto } as any;

      repository.create.mockReturnValue(expectedEntry);
      repository.save.mockResolvedValue(expectedEntry);

      const result = await service.createHistoryEntry(userId, createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        userId,
      });
      expect(repository.save).toHaveBeenCalledWith(expectedEntry);
      expect(result).toEqual(expectedEntry);
    });

    it('should handle creation errors', async () => {
      const userId = 1;
      const createDto: CreateFileHistoryDto = {
        date: new Date('2024-01-01'),
        filename: 'test.pdf',
        provider: 'dropbox',
      };

      repository.create.mockReturnValue({} as any);
      repository.save.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createHistoryEntry(userId, createDto),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getHistoryByUserId', () => {
    it('should return paginated history with default parameters', async () => {
      const userId = 1;
      const mockHistory = [
        { id: 1, filename: 'file1.pdf', date: new Date('2024-01-02') },
        { id: 2, filename: 'file2.pdf', date: new Date('2024-01-01') },
      ];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockHistory, 2]),
      };

      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getHistoryByUserId(userId);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('history');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'history.userId = :userId',
        { userId },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('history.date', 'DESC');
      expect(result).toEqual({
        data: mockHistory,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });
  });

  describe('getRecentHistory', () => {
    it('should return last 10 entries', async () => {
      const userId = 1;
      const mockHistory = [
        { id: 1, filename: 'recent1.pdf' },
        { id: 2, filename: 'recent2.pdf' },
      ];

      repository.find.mockResolvedValue(mockHistory);

      const result = await service.getRecentHistory(userId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { date: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getHistoryStats', () => {
    it('should calculate statistics correctly', async () => {
      const userId = 1;
      const mockHistory = [
        { provider: 'dropbox', fileSize: 1024 },
        { provider: 'dropbox', fileSize: 2048 },
        { provider: 'onedrive', fileSize: 512 },
      ];

      repository.find.mockResolvedValue(mockHistory);

      const result = await service.getHistoryStats(userId);

      expect(result).toEqual({
        totalFiles: 3,
        totalSize: 3584,
        providerStats: {
          dropbox: 2,
          onedrive: 1,
        },
      });
    });
  });

  describe('cleanupOldEntries', () => {
    it('should delete entries older than specified days', async () => {
      const olderThanDays = 90;
      const mockResult = { affected: 5 };

      const queryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockResult),
      };

      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.cleanupOldEntries(olderThanDays);

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.delete).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'date < :cutoffDate',
        expect.objectContaining({
          cutoffDate: expect.any(Date),
        }),
      );
      expect(result).toBe(5);
    });
  });
});