import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveRejectApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorNotes?: string;
}
