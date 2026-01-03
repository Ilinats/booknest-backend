import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApplicationStatus } from '../enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status!: Extract<ApplicationStatus, 'approved' | 'rejected'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorNotes?: string;
}
