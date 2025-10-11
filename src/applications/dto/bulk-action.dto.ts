import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class BulkActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  applicationIds!: string[];

  @IsEnum(['approved', 'rejected'] as const)
  action!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  authorNotes?: string;
}
