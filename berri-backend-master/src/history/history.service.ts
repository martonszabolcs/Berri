import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileHistory } from './entities/file-history.entity';
import { CreateFileHistoryDto, FileHistoryQueryDto } from './dto/file-history.dto';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    @InjectRepository(FileHistory)
    private historyRepository: Repository<FileHistory>,
  ) {}

  /**
   * Create a new file history entry
   */
  async createHistoryEntry(
    userId: number,
    createDto: CreateFileHistoryDto,
  ): Promise<FileHistory> {
    try {
      const historyEntry = this.historyRepository.create({
        ...createDto,
        userId,
      });

      const saved = await this.historyRepository.save(historyEntry);
      
      this.logger.log(
        `File history entry created: ${createDto.filename} for user ${userId}`,
      );

      return saved;
    } catch (error) {
      this.logger.error(
        `Failed to create history entry for user ${userId}:`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get file history for a user (latest first)
   */
  async getHistoryByUserId(
    userId: number,
    query: FileHistoryQueryDto = {},
  ): Promise<{
    data: FileHistory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, provider } = query;
    
    const queryBuilder = this.historyRepository
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId });

    // Provider filter
    if (provider) {
      queryBuilder.andWhere('history.provider = :provider', { provider });
    }

    // Ordering by date (newest first)
    queryBuilder.orderBy('history.date', 'DESC');

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get recent history entries (last 10)
   */
  async getRecentHistory(userId: number): Promise<FileHistory[]> {
    return this.historyRepository.find({
      where: { userId },
      order: { date: 'DESC' },
      take: 10,
    });
  }

  /**
   * Get history statistics for a user
   */
  async getHistoryStats(userId: number): Promise<{
    totalFiles: number;
    totalSize: number;
    providerStats: Record<string, number>;
  }> {
    const history = await this.historyRepository.find({
      where: { userId },
    });

    const stats = {
      totalFiles: history.length,
      totalSize: history.reduce((sum, entry) => sum + (entry.fileSize || 0), 0),
      providerStats: {} as Record<string, number>,
    };

    // Count by provider
    history.forEach((entry) => {
      stats.providerStats[entry.provider] = 
        (stats.providerStats[entry.provider] || 0) + 1;
    });

    return stats;
  }

  /**
   * Delete old history entries (cleanup)
   */
  async cleanupOldEntries(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.historyRepository
      .createQueryBuilder()
      .delete()
      .where('date < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(
      `Cleaned up ${result.affected || 0} history entries older than ${olderThanDays} days`,
    );

    return result.affected || 0;
  }
}