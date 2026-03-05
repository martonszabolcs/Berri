import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Destination } from './entities/destination.entity';
import { DestinationsController } from './destinations.controller';
import { DestinationsService } from './destinations.service';
import { UsersModule } from '../users/users.module';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [TypeOrmModule.forFeature([Destination]), UsersModule, CoreModule],
  controllers: [DestinationsController],
  providers: [DestinationsService],
  exports: [DestinationsService],
})
export class DestinationsModule {}