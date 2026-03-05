import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { UserSettings } from '../settings/entities/user-settings.entity';
import { Destination } from '../destinations/entities/destination.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserSettings, Destination])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
