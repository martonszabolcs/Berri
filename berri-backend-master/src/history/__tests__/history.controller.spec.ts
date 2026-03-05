import { Test, TestingModule } from '@nestjs/testing';
import { HistoryController } from '../history.controller';
import { HistoryService } from '../history.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FileHistoryQueryDto } from '../dto/file-history.dto';

describe('HistoryController', () => {
  let controller: HistoryController;


  const mockHistoryService = {
    getHistoryByUserId: jest.fn(),
    getRecentHistory: jest.fn(),
    getHistoryStats: jest.fn(),
  };

  const mockJwtGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoryController],
      providers: [
        {
          provide: HistoryService,
          useValue: mockHistoryService,
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue(mockJwtGuard)
    .compile();

    controller = module.get<HistoryController>(HistoryController);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHistory', () => {
    it('should return user history', async () => {
      const req = { user: { sub: 1 } };
      const query: FileHistoryQueryDto = {
        page: 1,
        limit: 20,
      };
      const expectedResult = {
        data: [
          { id: 1, filename: 'test.pdf' },
          { id: 2, filename: 'test2.pdf' },
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockHistoryService.getHistoryByUserId.mockResolvedValue(expectedResult);

      const result = await controller.getHistory(req as any, query);

      expect(mockHistoryService.getHistoryByUserId).toHaveBeenCalledWith(1, query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle provider filter', async () => {
      const req = { user: { sub: 1 } };
      const query: FileHistoryQueryDto = {
        page: 1,
        limit: 10,
        provider: 'dropbox',
      };

      mockHistoryService.getHistoryByUserId.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      await controller.getHistory(req as any, query);

      expect(mockHistoryService.getHistoryByUserId).toHaveBeenCalledWith(1, query);
    });
  });

  describe('getRecentHistory', () => {
    it('should return recent history', async () => {
      const req = { user: { sub: 1 } };
      const expectedResult = [
        { id: 1, filename: 'recent1.pdf' },
        { id: 2, filename: 'recent2.pdf' },
      ];

      mockHistoryService.getRecentHistory.mockResolvedValue(expectedResult);

      const result = await controller.getRecentHistory(req as any);

      expect(mockHistoryService.getRecentHistory).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getHistoryStats', () => {
    it('should return history statistics', async () => {
      const req = { user: { sub: 1 } };
      const expectedResult = {
        totalFiles: 10,
        totalSize: 1024000,
        providerStats: {
          dropbox: 5,
          onedrive: 3,
          googledrive: 2,
        },
      };

      mockHistoryService.getHistoryStats.mockResolvedValue(expectedResult);

      const result = await controller.getHistoryStats(req as any);

      expect(mockHistoryService.getHistoryStats).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedResult);
    });
  });
});