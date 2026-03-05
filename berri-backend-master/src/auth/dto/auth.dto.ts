import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  readonly email: string;

  @ApiProperty({ description: 'User password' })
  @IsString()
  readonly password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  readonly email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token' })
  @IsString()
  readonly token: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  readonly password: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token' })
  @IsString()
  readonly token: string;
}

export class SocialLoginDto {
  @ApiProperty({ description: 'Access token from social provider' })
  @IsString()
  readonly accessToken: string;

  @ApiProperty({ description: 'Platform (android/ios)', required: false })
  @IsString()
  readonly platform?: string;

  @ApiProperty({ description: 'Newsletter subscription', required: false })
  readonly newsletter?: boolean;

  @ApiProperty({ description: 'Nonce for Apple login', required: false })
  @IsString()
  readonly nonce?: string;
}
