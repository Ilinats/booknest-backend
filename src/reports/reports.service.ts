import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserReport } from './entity/user-report.entity';
import { User } from '../users/entity/user.entity';
import { CreateUserReportDto } from './dto/create-user-report.dto';
import { ReportErrorCode } from './errors';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(UserReport)
    private readonly reportRepository: Repository<UserReport>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async reportUser(
    reporterId: string,
    dto: CreateUserReportDto,
  ): Promise<UserReport> {
    if (reporterId === dto.reportedUserId) {
      throw new ForbiddenException(ReportErrorCode.CANNOT_REPORT_SELF);
    }

    const reportedUser = await this.userRepository.findOne({
      where: { id: dto.reportedUserId },
    });
    if (!reportedUser) {
      throw new NotFoundException(ReportErrorCode.REPORTED_USER_NOT_FOUND);
    }

    const report = this.reportRepository.create({
      reportedUserId: dto.reportedUserId,
      reportedById: reporterId,
      reason: dto.reason,
      message: dto.message ?? null,
    });

    return this.reportRepository.save(report);
  }
}
