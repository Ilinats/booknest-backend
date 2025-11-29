import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceTokenService } from './device-token.service';
import { RegisterDeviceTokenDto, UpdateDeviceTokenDto } from './dto/device-token.dto';
import { getUserId } from '../common/get-user-id.util';

@Controller('device-tokens')
@UseGuards(JwtAuthGuard)
export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async registerToken(@Request() req: any, @Body() dto: RegisterDeviceTokenDto) {
    const userId = getUserId(req);
    return this.deviceTokenService.registerToken(userId, dto);
  }

  @Get()
  async getMyTokens(@Request() req: any) {
    const userId = getUserId(req);
    return this.deviceTokenService.getAllUserTokens(userId);
  }

  @Put(':token')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateToken(
    @Request() req: any,
    @Param('token') token: string,
    @Body() dto: UpdateDeviceTokenDto,
  ) {
    const userId = getUserId(req);
    return this.deviceTokenService.updateToken(userId, token, dto);
  }

  @Delete(':token')
  async deleteToken(@Request() req: any, @Param('token') token: string) {
    const userId = getUserId(req);
    await this.deviceTokenService.deleteToken(userId, token);
    return { success: true, message: 'Device token deleted' };
  }
}

