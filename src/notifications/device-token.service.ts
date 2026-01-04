import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './entity/device-token.entity';
import { RegisterDeviceTokenDto, UpdateDeviceTokenDto } from './dto';
import { BasePaginationDto, createPaginatedResponse } from '../common';

@Injectable()
export class DeviceTokenService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  async registerToken(
    userId: string,
    dto: RegisterDeviceTokenDto,
  ): Promise<DeviceToken> {
    let deviceToken = await this.deviceTokenRepository.findOne({
      where: { userId, token: dto.token },
    });

    if (deviceToken) {
      deviceToken.deviceType = dto.deviceType || deviceToken.deviceType;
      deviceToken.deviceId = dto.deviceId || deviceToken.deviceId;
      deviceToken.appVersion = dto.appVersion || deviceToken.appVersion;
      deviceToken.isActive = true;
      return this.deviceTokenRepository.save(deviceToken);
    }

    deviceToken = this.deviceTokenRepository.create({
      userId,
      token: dto.token,
      deviceType: dto.deviceType,
      deviceId: dto.deviceId,
      appVersion: dto.appVersion,
      isActive: true,
    });

    return this.deviceTokenRepository.save(deviceToken);
  }

  async getActiveTokens(userId: string): Promise<string[]> {
    const tokens = await this.deviceTokenRepository.find({
      where: { userId, isActive: true },
    });
    return tokens.map((t) => t.token);
  }
}
