import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';
import { CoreModule } from '../core/core.module';
import { jwtConstants } from './constants';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { SocialAuthController } from './controllers/social-auth.controller';

// Services
import { AuthService } from './services/auth.service';
import { GoogleAuthService } from './services/google-auth.service';
import { FacebookAuthService } from './services/facebook-auth.service';
import { AppleAuthService } from './services/apple-auth.service';

// Strategies
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    SettingsModule,
    CoreModule,
    PassportModule,
    HttpModule,
    ConfigModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController, SocialAuthController],
  providers: [
    AuthService,
    GoogleAuthService,
    FacebookAuthService,
    AppleAuthService,
    LocalStrategy,
    JwtStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
