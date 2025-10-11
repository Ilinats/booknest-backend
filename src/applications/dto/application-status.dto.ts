import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ApplicationStatusDto {
  @IsEnum(['approved', 'rejected'] as const)
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  authorNotes?: string;
}
