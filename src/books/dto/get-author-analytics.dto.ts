import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DateRange } from '../enums';

export class GetAuthorAnalyticsDto {
  @ApiPropertyOptional({
    enum: DateRange,
    description: 'Date range for analytics',
    default: DateRange.ALL_TIME,
  })
  @IsOptional()
  @IsEnum(DateRange)
  dateRange?: DateRange;
}

