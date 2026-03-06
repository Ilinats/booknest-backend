import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceTokenService } from './device-token.service';
import { DeviceToken } from './entity/device-token.entity';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
}

describe('DeviceTokenService', () => {
  let service: DeviceTokenService;
  let deviceTokenRepository: MockRepo<DeviceToken>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceTokenService,
        {
          provide: getRepositoryToken(DeviceToken),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<DeviceTokenService>(DeviceTokenService);
    deviceTokenRepository = module.get(getRepositoryToken(DeviceToken));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerToken', () => {
    const userId = 'user-1';
    const dto = {
      token: 'token-1',
      deviceType: 'ios',
      deviceId: 'device-1',
      appVersion: '1.0.0',
    };

    it('should update existing token when found', async () => {
      const existing: DeviceToken = {
        id: '1',
        userId,
        token: dto.token,
        deviceType: 'android',
        deviceId: 'old-device',
        appVersion: '0.9.0',
        isActive: false,
      } as any;

      deviceTokenRepository.findOne.mockResolvedValue(existing);
      deviceTokenRepository.save.mockImplementation(async (t) => t);

      const result = await service.registerToken(userId, dto as any);

      expect(result.isActive).toBe(true);
      expect(result.deviceType).toBe(dto.deviceType);
      expect(result.deviceId).toBe(dto.deviceId);
      expect(result.appVersion).toBe(dto.appVersion);
    });

    it('should create new token when not found', async () => {
      deviceTokenRepository.findOne.mockResolvedValue(null);

      const created: DeviceToken = {
        id: '1',
        userId,
        token: dto.token,
        deviceType: dto.deviceType,
        deviceId: dto.deviceId,
        appVersion: dto.appVersion,
        isActive: true,
      } as any;

      deviceTokenRepository.create.mockReturnValue(created);
      deviceTokenRepository.save.mockResolvedValue(created);

      const result = await service.registerToken(userId, dto as any);

      expect(deviceTokenRepository.create).toHaveBeenCalledWith({
        userId,
        token: dto.token,
        deviceType: dto.deviceType,
        deviceId: dto.deviceId,
        appVersion: dto.appVersion,
        isActive: true,
      });
      expect(result).toEqual(created);
    });
  });

  describe('getActiveTokens', () => {
    it('should return list of active tokens for user', async () => {
      const tokens: DeviceToken[] = [
        {
          id: '1',
          userId: 'user-1',
          token: 't1',
          isActive: true,
        } as any,
        {
          id: '2',
          userId: 'user-1',
          token: 't2',
          isActive: true,
        } as any,
      ];

      deviceTokenRepository.find.mockResolvedValue(tokens);

      const result = await service.getActiveTokens('user-1');

      expect(deviceTokenRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
      });
      expect(result).toEqual(['t1', 't2']);
    });
  });
});
