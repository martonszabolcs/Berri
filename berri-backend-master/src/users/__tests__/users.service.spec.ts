import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users.service';
import { User } from '../user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const mockRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOneByEmail', () => {
    it('should return user when found', async () => {
      const email = 'test@example.com';
      const user = { id: 1, email, name: 'Test User' };

      mockRepository.findOneBy.mockResolvedValue(user);

      const result = await service.findOneByEmail(email);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ email });
      expect(result).toEqual(user);
    });
  });
});