import { IsEnum, IsOptional } from 'class-validator';

export class UpdateReadingStatusDto {
  @IsEnum(['not_started', 'currently_reading', 'for_review', 'reviewed'] as const)
  readingStatus!: 'not_started' | 'currently_reading' | 'for_review' | 'reviewed';
}
