import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';

export class CreateFileHistoryDto {
  @ApiProperty({ description: 'Upload date' })
  @IsDateString()
  date: Date;

  @ApiProperty({ description: 'Original filename' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'Download/View URL', required: false })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ description: 'Storage provider' })
  @IsString()
  provider: string;

  @ApiProperty({ description: 'File size in bytes', required: false })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiProperty({ description: 'File MIME type', required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class FileHistoryQueryDto {
  @ApiProperty({ description: 'Page number', default: 1, required: false })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', default: 20, required: false })
  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  @ApiProperty({ 
    description: 'Filter by storage provider', 
    required: false,
    enum: ['dropbox', 'onedrive', 'googledrive'],
  })
  @IsOptional()
  @IsString()
  provider?: string;
}