import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserSettingsService } from './user-settings.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UserSettings } from './entities/user-settings.entity';

@ApiTags('user-settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access_token')
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  @Get('')
  @ApiOperation({ summary: 'Get user settings' })
  @ApiResponse({
    status: 200,
    description: 'User settings retrieved successfully',
    type: UserSettings,
  })
  async getSettings(
    @Request() req: { user: { sub: number } },
  ): Promise<UserSettings> {
    console.log('Controller getSettings called with req.user:', req.user);
    const userId = Number(req.user.sub);
    console.log('Converted userId:', userId);
    return this.userSettingsService.findByUserId(userId);
  }

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint' })
  async testEndpoint(@Request() req: any): Promise<any> {
    console.log('TEST ENDPOINT CALLED');
    console.log('req.user:', req.user);
    return { message: 'Test endpoint works', user: req.user };
  }

  @Put('')
  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({
    status: 200,
    description: 'User settings updated successfully',
    type: UserSettings,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateSettings(
    @Request() req: { user: { sub: number } },
    @Body(ValidationPipe) updateDto: UpdateUserSettingsDto,
  ): Promise<UserSettings> {
    const userId = Number(req.user.sub);
    return this.userSettingsService.updateSettings(userId, updateDto);
  }
}
