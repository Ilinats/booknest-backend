import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason } from '../enums/report-reasons.enum';

export class UserReportResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  reportedUserId!: string;

  @ApiProperty()
  reportedById!: string;

  @ApiProperty({ enum: ReportReason })
  reason!: ReportReason;

  @ApiPropertyOptional()
  message?: string | null;

  @ApiProperty()
  createdAt!: Date;
}
