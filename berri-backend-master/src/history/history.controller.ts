import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HistoryService } from './history.service';
import { FileHistory } from './entities/file-history.entity';
import { FileHistoryQueryDto } from './dto/file-history.dto';

@ApiTags('history')
@Controller('history')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access_token')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get file upload history for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ 
    name: 'provider', 
    required: false, 
    enum: ['dropbox', 'onedrive', 'googledrive'],
    description: 'Filter by storage provider' 
  })
  @ApiResponse({
    status: 200,
    description: 'History retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/FileHistory' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  async getHistory(
    @Request() req: { user: { sub: number } },
    @Query(ValidationPipe) query: FileHistoryQueryDto,
  ) {
    return this.historyService.getHistoryByUserId(req.user.sub, query);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent file uploads (last 10)' })
  @ApiResponse({
    status: 200,
    description: 'Recent history retrieved successfully',
    type: [FileHistory],
  })
  async getRecentHistory(
    @Request() req: { user: { sub: number } },
  ): Promise<FileHistory[]> {
    return this.historyService.getRecentHistory(req.user.sub);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get file upload statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalFiles: { type: 'number', description: 'Total uploaded files' },
        totalSize: { type: 'number', description: 'Total size in bytes' },
        providerStats: {
          type: 'object',
          description: 'Files count by storage provider',
          additionalProperties: { type: 'number' },
        },
      },
    },
  })
  async getHistoryStats(
    @Request() req: { user: { sub: number } },
  ) {
    return this.historyService.getHistoryStats(req.user.sub);
  }
}