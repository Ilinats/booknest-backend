import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReportReason } from '../enums/report-reasons.enum';

export class CreateUserReportDto {
  @ApiProperty({
    description: 'ID of the user being reported',
    example: '1b2e4e1a-1234-4c56-9abc-1234567890ab',
  })
  @IsUUID()
  reportedUserId!: string;

  @ApiProperty({
    description: 'Reason for the report',
    enum: ReportReason,
    example: ReportReason.ABUSE,
  })
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @ApiPropertyOptional({
    description: 'Additional details about the report',
    example: 'User is sending abusive messages and spam links.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
