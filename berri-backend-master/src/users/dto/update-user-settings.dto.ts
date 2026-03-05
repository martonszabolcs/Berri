import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserSettingsDto {
  // Dropbox beállítások
  @ApiProperty({
    description: 'Dropbox access token',
    required: false,
  })
  @IsOptional()
  @IsString()
  dropboxAccessToken?: string;

  @ApiProperty({
    description: 'Dropbox refresh token',
    required: false,
  })
  @IsOptional()
  @IsString()
  dropboxRefreshToken?: string;

  // OneDrive beállítások
  @ApiProperty({
    description: 'OneDrive access token',
    required: false,
  })
  @IsOptional()
  @IsString()
  oneDriveAccessToken?: string;

  @ApiProperty({
    description: 'OneDrive refresh token',
    required: false,
  })
  @IsOptional()
  @IsString()
  oneDriveRefreshToken?: string;

  // Google Drive beállítások
  @ApiProperty({
    description: 'Google Drive access token',
    required: false,
  })
  @IsOptional()
  @IsString()
  googleDriveAccessToken?: string;

  @ApiProperty({
    description: 'Google Drive refresh token',
    required: false,
  })
  @IsOptional()
  @IsString()
  googleDriveRefreshToken?: string;

  // File naming beállítások
  @ApiProperty({
    description: 'File naming template',
    required: false,
    default: '{timestamp}_{originalname}',
  })
  @IsOptional()
  @IsString()
  fileNaming?: string;
}
