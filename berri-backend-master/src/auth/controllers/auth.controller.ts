import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../../core/email/email.service';
import { Public } from '../decorators/public.decorator';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { User } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import {
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from '../dto/auth.dto';
import { AuthTokens, AuthResponse } from '../interfaces/auth.interface';
import { Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      properties: {
        access_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: 'string' },
            emailVerified: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Request() req: { user: Omit<User, 'password'> }): AuthTokens {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(
    @Body(ValidationPipe) createUserDto: CreateUserDto,
  ): Promise<AuthResponse> {
    return this.authService.register(createUserDto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent',
    schema: {
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgottenPassword(
    @Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto,
  ): Promise<AuthResponse> {
    return this.authService.forgottenPassword(forgotPasswordDto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    schema: {
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body(ValidationPipe) resetPasswordDto: ResetPasswordDto,
  ): Promise<AuthResponse> {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid verification token' })
  async verifyEmail(
    @Body(ValidationPipe) verifyEmailDto: VerifyEmailDto,
  ): Promise<AuthResponse> {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Public()
  @Post('test-email')
  @ApiOperation({ summary: 'Test email sending (MailHog)' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  async testEmail(@Body() body: { email: string }): Promise<AuthResponse> {
    try {
      await this.emailService.testEmail(body.email);
      return {
        message:
          'Test email sent successfully! Check MailHog at http://localhost:8025',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { message: 'Email sending failed: ' + errorMessage };
    }
  }

  @Public()
  @Get('verify-email/:token')
  @ApiOperation({ summary: 'Verify email address via GET with HTML response' })
  @ApiResponse({
    status: 200,
    description: 'HTML page with verification result',
    type: 'text/html',
  })
  @ApiResponse({ status: 400, description: 'Invalid verification token' })
  async verifyEmailHtml(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.authService.verifyEmail(token);
      
      const successHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verified - Berri App</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                    padding: 40px;
                    text-align: center;
                    max-width: 500px;
                    width: 100%;
                }
                .icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .title {
                    color: #333;
                    font-size: 28px;
                    font-weight: 700;
                    margin-bottom: 16px;
                }
                .message {
                    color: #666;
                    font-size: 16px;
                    line-height: 1.6;
                    margin-bottom: 30px;
                }
                .button {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    padding: 15px 30px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    transition: transform 0.2s ease;
                }
                .button:hover {
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">✅</div>
                <h1 class="title">Email Successfully Verified!</h1>
                <p class="message">
                    Your email address has been successfully confirmed. 
                    You can now enjoy all features of the Berri App.
                </p>
            </div>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(successHtml);
    } catch {
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verification Error - Berri App</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                    padding: 40px;
                    text-align: center;
                    max-width: 500px;
                    width: 100%;
                }
                .icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .title {
                    color: #333;
                    font-size: 28px;
                    font-weight: 700;
                    margin-bottom: 16px;
                }
                .message {
                    color: #666;
                    font-size: 16px;
                    line-height: 1.6;
                    margin-bottom: 30px;
                }
                .button {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    padding: 15px 30px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    transition: transform 0.2s ease;
                }
                .button:hover {
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">❌</div>
                <h1 class="title">Verification Failed</h1>
                <p class="message">
                    The verification link is invalid or has expired. 
                    Please request a new verification email or contact support.
                </p>
            </div>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.status(400).send(errorHtml);
    }
  }
}
