import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'User name', required: false })
  @IsOptional()
  @IsString()
  readonly name?: string;

  @ApiProperty({ description: 'User email address' })
  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @ApiProperty({ description: 'User password' })
  @IsNotEmpty()
  @IsString()
  readonly password: string;
}
