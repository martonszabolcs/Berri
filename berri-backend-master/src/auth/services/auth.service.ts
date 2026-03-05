import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { User } from '../../users/user.entity';
import { EmailService } from '../../core/email/email.service';
import * as bcrypt from 'bcrypt';
import { addHours, isAfter } from 'date-fns';
import { AuthTokens, AuthResponse } from '../interfaces/auth.interface';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(
    email: string | undefined,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersService.findOneByEmail(email);
    if (user) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  login(user: Omit<User, 'password'>): AuthTokens {
    const payload = { email: user.email, sub: user.id };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        emailVerified: user.emailVerified,
      },
    };
  }

  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.usersService.findOneByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const created = await this.usersService.create(createUserDto);

    if (!created) {
      throw new InternalServerErrorException('Failed to create user');
    }

    // Send email verification
    if (created.emailVerificationToken) {
      try {
        await this.emailService.sendEmailVerification(
          created.email,
          created.emailVerificationToken,
        );
      } catch (error) {
        console.log('Email sending failed:', error);
        // Continue registration even if email fails
      }
    }

    return {
      message: 'User registered successfully. Please verify your email.',
    };
  }

  async forgottenPassword(email: string): Promise<AuthResponse> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new HttpException('User not found', 404);
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = token;
    user.resetPasswordExpires = addHours(Date.now(), 1);
    await this.usersService.update(user);

    // Send email with reset token
    try {
      await this.emailService.sendPasswordReset(email, token);
    } catch (error) {
      console.log('Email sending failed:', error);
      // Continue even if email fails
    }

    return { message: 'Password reset email sent' };
  }

  async resetPassword(token: string, password: string): Promise<AuthResponse> {
    const user = await this.usersService.findOneByResetPasswordToken(token);
    if (!user || !user.resetPasswordExpires) {
      throw new HttpException('Invalid or expired token', 400);
    }

    if (!isAfter(new Date(user.resetPasswordExpires), Date.now())) {
      throw new HttpException('Token expired', 400);
    }

    user.password = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.usersService.update(user);

    // Send password reset confirmation email
    try {
      await this.emailService.sendPasswordResetConfirmation(user.email);
    } catch (error) {
      console.log('Email sending failed:', error);
      // Continue even if email fails
    }

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(token: string): Promise<AuthResponse> {
    const user = await this.usersService.findOneByEmailVerificationToken(token);
    if (!user) {
      throw new HttpException('Invalid verification token', 400);
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    await this.usersService.update(user);

    return { message: 'Email verified successfully' };
  }

  async socialLogin(email: string, name?: string): Promise<AuthTokens> {
    let user = await this.usersService.findOneByEmail(email);

    if (!user) {
      // Create new user for social login
      const createUserDto: CreateUserDto = {
        email,
        name: name || email.split('@')[0],
        password: this.generateRandomPassword(), // Random password for social users
      };

      user = await this.usersService.create(createUserDto);
      if (user) {
        user.emailVerified = true; // Social logins are pre-verified
        await this.usersService.update(user);
      }
    }

    if (!user) {
      throw new InternalServerErrorException(
        'Failed to login with social provider',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return this.login(userWithoutPassword);
  }

  private generateRandomPassword(): string {
    return (
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8)
    );
  }
}
