import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, ReadingStatus } from '../enums';

export class UpdateApplicationCompleteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applicationMessage?: string;

  @ApiPropertyOptional({
    enum: ApplicationStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorNotes?: string;

  @ApiPropertyOptional({
    enum: ReadingStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReadingStatus)
  readingStatus?: ReadingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  markCopySent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  markCopyReceived?: boolean;
}
