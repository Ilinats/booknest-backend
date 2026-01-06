import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateUserReportDto } from './dto/create-user-report.dto';
import { UserReportResponseDto } from './dto/user-report-response.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('users')
  @ApiOperation({ summary: 'Report a user' })
  @ApiResponse({
    status: 201,
    description: 'User reported successfully',
    type: UserReportResponseDto,
  })
  async reportUser(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUserReportDto,
  ): Promise<UserReportResponseDto> {
    const report = await this.reportsService.reportUser(user.sub, dto);
    return {
      id: report.id,
      reportedUserId: report.reportedUserId,
      reportedById: report.reportedById,
      reason: report.reason,
      message: report.message ?? null,
      createdAt: report.createdAt,
    };
  }
}
