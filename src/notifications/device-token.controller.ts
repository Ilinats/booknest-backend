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

  @Get()
  @ApiOperation({
    summary: 'Get all device tokens for current user (Authenticated)',
  })
  @ApiResponse({ status: 200, description: 'List of device tokens' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getMyTokens(@Request() req: any, @Query() dto: BasePaginationDto) {
    const userId = getUserId(req);
    return this.deviceTokenService.getAllUserTokens(userId, dto);
  }

  @Patch(':token')
  @ApiOperation({ summary: 'Update a device token (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Device token updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Delete a device token (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Device token deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteToken(@Request() req: any, @Param('token') token: string) {
    const userId = getUserId(req);
    await this.deviceTokenService.deleteToken(userId, token);
    return { message: 'Device token deleted' };
  }
}
