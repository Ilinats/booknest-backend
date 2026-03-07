import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationCodeService } from './verification-code.service';
import { VerificationCode } from '../entity/verification-code.entity';
import { VerificationTypeEnum } from '../enums';
import { User } from '../../users/entity/user.entity';
import { MailService } from '../../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('VerificationCodeService', () => {
  let service: VerificationCodeService;
  let verificationCodeRepo: MockRepo<VerificationCode>;
  let userRepo: MockRepo<User>;
  let mailService: jest.Mocked<MailService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationCodeService,
        {
          provide: getRepositoryToken(VerificationCode),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
        {
          provide: MailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VerificationCodeService>(VerificationCodeService);
    verificationCodeRepo = module.get(getRepositoryToken(VerificationCode));
    userRepo = module.get(getRepositoryToken(User));
    mailService = module.get(MailService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createVerificationCode', () => {
    it('should mark existing codes as used and create new one', async () => {
      const created: VerificationCode = {
        id: 'vc1',
        userId: 'u1',
        code: '123456',
        type: VerificationTypeEnum.EMAIL_VERIFICATION,
        expiresAt: new Date(),
      } as any;

      verificationCodeRepo.create.mockReturnValue(created);
      verificationCodeRepo.save.mockResolvedValue(created);

      const result = await service.createVerificationCode(
        'u1',
        VerificationTypeEnum.EMAIL_VERIFICATION,
      );

      expect(verificationCodeRepo.update).toHaveBeenCalled();
      expect(verificationCodeRepo.create).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('verifyCode', () => {
    it('should return isValid false when code not found', async () => {
      verificationCodeRepo.findOne.mockResolvedValue(null);

      const result = await service.verifyCode(
        '123456',
        VerificationTypeEnum.EMAIL_VERIFICATION,
      );

      expect(result.isValid).toBe(false);
    });

    it('should return isValid false when code expired', async () => {
      const code: VerificationCode = {
        id: 'vc1',
        userId: 'u1',
        code: '123456',
        type: VerificationTypeEnum.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() - 1000),
      } as any;

      verificationCodeRepo.findOne.mockResolvedValue(code);

      const result = await service.verifyCode(
        '123456',
        VerificationTypeEnum.EMAIL_VERIFICATION,
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('sendVerificationEmail', () => {
    it('should throw when gmail credentials missing', async () => {
      const user: User = {
        id: 'u1',
        email: 'test@example.com',
      } as any;

      configService.get.mockReturnValueOnce('http://localhost:3000'); // APP_URL
      configService.get.mockReturnValueOnce(null); // GMAIL_USER
      configService.get.mockReturnValueOnce(null); // GMAIL_APP_PASSWORD

      await expect(
        service.sendVerificationEmail(user, '123456'),
      ).rejects.toThrowError('Gmail credentials not configured');
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('should call delete on repository', async () => {
      verificationCodeRepo.delete.mockResolvedValue({} as any);

      await service.cleanupExpiredCodes();

      expect(verificationCodeRepo.delete).toHaveBeenCalled();
    });
  });
});
