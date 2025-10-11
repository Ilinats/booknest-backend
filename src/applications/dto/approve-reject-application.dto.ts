import { IsOptional, IsString } from 'class-validator';

export class ApproveRejectApplicationDto {
  @IsOptional()
  @IsString()
  authorNotes?: string;
}
