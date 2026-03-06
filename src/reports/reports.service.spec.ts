import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportsService } from './reports.service';
import { UserReport } from './entity/user-report.entity';
import { User } from '../users/entity/user.entity';
import { CreateUserReportDto } from './dto/create-user-report.dto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportErrorCode } from './errors';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let reportRepository: MockRepo<UserReport>;
  let userRepository: MockRepo<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(UserReport),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    reportRepository = module.get(getRepositoryToken(UserReport));
    userRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportUser', () => {
    const baseDto: CreateUserReportDto = {
      reportedUserId: 'user-2',
      reason: 'spam' as any,
      message: 'Spamming messages',
    };

    it('should throw ForbiddenException when reporting self', async () => {
      await expect(
        service.reportUser('user-1', { ...baseDto, reportedUserId: 'user-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw NotFoundException when reported user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.reportUser('user-1', baseDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: baseDto.reportedUserId },
      });
    });

    it('should create and save report when valid', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'user-2' } as User);

      const report: UserReport = {
        id: 'report-1',
        reportedUserId: baseDto.reportedUserId,
        reportedById: 'user-1',
        reason: baseDto.reason,
        message: baseDto.message,
      } as any;

      reportRepository.create.mockReturnValue(report);
      reportRepository.save.mockResolvedValue(report);

      const result = await service.reportUser('user-1', baseDto);

      expect(reportRepository.create).toHaveBeenCalledWith({
        reportedUserId: baseDto.reportedUserId,
        reportedById: 'user-1',
        reason: baseDto.reason,
        message: baseDto.message,
      });
      expect(reportRepository.save).toHaveBeenCalledWith(report);
      expect(result).toEqual(report);
    });
  });
});
