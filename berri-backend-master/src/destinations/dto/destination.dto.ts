import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsBoolean,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { DestinationType, FileType } from '../entities/destination.entity';

export class CreateDestinationDto {
  @ApiProperty({
    description: 'Type number (1-7), unique per user',
    minimum: 1,
    maximum: 7,
    example: 1,
  })
  @IsNumber()
  @Min(1)
  @Max(7)
  type: number;

  @ApiProperty({
    description: 'File type',
    enum: FileType,
    example: FileType.JPG,
  })
  @IsEnum(FileType)
  fileType: FileType;

  @ApiProperty({
    description: 'Whether files should be bundled',
    example: false,
  })
  @IsBoolean()
  bundled: boolean;

  @ApiProperty({
    description: 'Destination provider',
    enum: DestinationType,
    example: DestinationType.EMAIL,
  })
  @IsEnum(DestinationType)
  destination: DestinationType;

  @ApiProperty({
    description: 'Email addresses (comma-separated)',
    required: false,
    example: 'user@example.com,admin@example.com',
  })
  @IsOptional()
  @IsString()
  emails?: string;
}

export class UpdateDestinationDto {
  @ApiProperty({
    description: 'File type',
    enum: FileType,
    required: false,
  })
  @IsOptional()
  @IsEnum(FileType)
  fileType?: FileType;

  @ApiProperty({
    description: 'Whether files should be bundled',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  bundled?: boolean;

  @ApiProperty({
    description: 'Destination provider',
    enum: DestinationType,
    required: false,
  })
  @IsOptional()
  @IsEnum(DestinationType)
  destination?: DestinationType;

  @ApiProperty({
    description: 'Email addresses (comma-separated)',
    required: false,
  })
  @IsOptional()
  @IsString()
  emails?: string;
}