import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeviceTokenService } from './device-token.service';
import { RegisterDeviceTokenDto, UpdateDeviceTokenDto } from './dto';
import { getUserId, BasePaginationDto } from '../common';

@ApiTags('Device Tokens')
@Controller('device-tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a device token (Authenticated)' })
  @ApiResponse({
    status: 201,
    description: 'Device token registered successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async registerToken(
    @Request() req: any,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const userId = getUserId(req);
    return this.deviceTokenService.registerToken(userId, dto);
  }
}
