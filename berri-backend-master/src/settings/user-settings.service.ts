import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private userSettingsRepository: Repository<UserSettings>,
  ) {}

  async findByUserId(userId: number): Promise<UserSettings> {
    console.log(
      'findByUserId called with userId:',
      userId,
      'type:',
      typeof userId,
    );
    let settings = await this.userSettingsRepository.findOne({
      where: { userId },
    });

    console.log('Found settings:', settings);

    // Ha nincs beállítás, létrehozunk egy alapértelmezett
    if (!settings) {
      console.log('Creating default settings for userId:', userId);
      settings = await this.createDefaultSettings(userId);
    }

    return settings;
  }

  async updateSettings(
    userId: number,
    updateDto: UpdateUserSettingsDto,
  ): Promise<UserSettings> {
    let settings = await this.userSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = await this.createDefaultSettings(userId);
    }

    // Frissítés
    Object.assign(settings, updateDto);

    return this.userSettingsRepository.save(settings);
  }

  private async createDefaultSettings(userId: number): Promise<UserSettings> {
    const defaultSettings = this.userSettingsRepository.create({
      userId,
      fileNaming: '{Berri}_{Year}_{Month}_{Day}',
    });

    return this.userSettingsRepository.save(defaultSettings);
  }

  async updateTokens(
    userId: number,
    tokenData: {
      dropboxAccessToken?: string;
      dropboxRefreshToken?: string;
      oneDriveAccessToken?: string;
      oneDriveRefreshToken?: string;
      googleDriveAccessToken?: string;
      googleDriveRefreshToken?: string;
    },
  ): Promise<UserSettings> {
    const settings = await this.findByUserId(userId);
    Object.assign(settings, tokenData);
    return this.userSettingsRepository.save(settings);
  }
}
