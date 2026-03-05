import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DestinationsModule } from './destinations/destinations.module';
import { SettingsModule } from './settings/settings.module';
// import { HistoryModule } from './history/history.module';
import { CoreModule } from './core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { UserSettings } from './settings/entities/user-settings.entity';
import { Destination } from './destinations/entities/destination.entity';
// import { FileHistory } from './history/entities/file-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'berri',
      entities: [User, UserSettings, Destination],
      synchronize: true, // dev only
    }),
    AuthModule,
    UsersModule,
    DestinationsModule,
    SettingsModule,
    // HistoryModule,
    CoreModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
