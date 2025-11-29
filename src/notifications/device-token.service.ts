import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './entity/device-token.entity';
import { RegisterDeviceTokenDto, UpdateDeviceTokenDto } from './dto/device-token.dto';

@Injectable()
export class DeviceTokenService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  async registerToken(userId: string, dto: RegisterDeviceTokenDto): Promise<DeviceToken> {
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

  async getAllUserTokens(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async deactivateToken(userId: string, token: string): Promise<void> {
    const deviceToken = await this.deviceTokenRepository.findOne({
      where: { userId, token },
    });

    if (deviceToken) {
      deviceToken.isActive = false;
      await this.deviceTokenRepository.save(deviceToken);
    }
  }

  async deleteToken(userId: string, token: string): Promise<void> {
    await this.deviceTokenRepository.delete({ userId, token });
  }

  async updateToken(
    userId: string,
    token: string,
    dto: UpdateDeviceTokenDto,
  ): Promise<DeviceToken> {
    const deviceToken = await this.deviceTokenRepository.findOne({
      where: { userId, token },
    });

    if (!deviceToken) {
      throw new Error('Device token not found');
    }

    if (dto.isActive !== undefined) {
      deviceToken.isActive = dto.isActive;
    }

    return this.deviceTokenRepository.save(deviceToken);
  }
}

