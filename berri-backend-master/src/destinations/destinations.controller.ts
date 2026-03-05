import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  ValidationPipe,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DestinationsService } from './destinations.service';
import { Destination } from './entities/destination.entity';
import {
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/destination.dto';

@ApiTags('destinations')
@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Get all destinations for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Destinations retrieved successfully',
    type: [Destination],
  })
  async findAll(
    @Request() req: { user: { sub: number } },
  ): Promise<Destination[]> {
    return this.destinationsService.findAllByUserId(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @Get(':type')
  @ApiOperation({ summary: 'Get destination by type' })
  @ApiParam({
    name: 'type',
    description: 'Destination type (1-7)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Destination found',
    type: Destination,
  })
  @ApiResponse({ status: 404, description: 'Destination not found' })
  async findByType(
    @Request() req: { user: { sub: number } },
    @Param('type', ParseIntPipe) type: number,
  ): Promise<Destination | null> {
    return this.destinationsService.findByUserIdAndType(req.user.sub, type);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @Post()
  @ApiOperation({ summary: 'Create a new destination' })
  @ApiResponse({
    status: 201,
    description: 'Destination created successfully',
    type: Destination,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or type already exists',
  })
  async create(
    @Request() req: { user: { sub: number } },
    @Body(ValidationPipe) createDto: CreateDestinationDto,
  ): Promise<Destination> {
    console.log('REQUEST');
    return this.destinationsService.create(req.user.sub, createDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @Put(':type')
  @ApiOperation({ summary: 'Update destination by type' })
  @ApiParam({
    name: 'type',
    description: 'Destination type (1-7)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Destination updated successfully',
    type: Destination,
  })
  @ApiResponse({ status: 404, description: 'Destination not found' })
  async update(
    @Request() req: { user: { sub: number } },
    @Param('type', ParseIntPipe) type: number,
    @Body(ValidationPipe) updateDto: UpdateDestinationDto,
  ): Promise<Destination> {
    return this.destinationsService.update(req.user.sub, type, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @Post('send/:type')
  @UseInterceptors(FilesInterceptor('files', 10)) // Allow up to 10 files
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload files and send to destination emails' })
  @ApiParam({
    name: 'type',
    description: 'Destination type (1-7)',
    type: 'number',
  })
  @ApiBody({
    description: 'Files to upload (PDF or JPG)',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Files sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        sentTo: { type: 'array', items: { type: 'string' } },
        filesCount: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request or invalid file type' })
  @ApiResponse({ status: 404, description: 'Destination not found' })
  async uploadFileAndSendToRecipients(
    @Request() req: { user: { sub: number } },
    @Param('type', ParseIntPipe) type: number,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ message: string; sentTo: string[]; filesCount: number }> {
    console.log('uploadFileAndSendToRecipients called with files:', files);
    return this.destinationsService.sendFilesToDestination(
      req.user.sub,
      type,
      files,
    );
  }
}
