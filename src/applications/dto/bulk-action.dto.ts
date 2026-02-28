import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApplicationStatus } from '../enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkActionDto {
  @ApiProperty()
  @IsArray()
  @IsUUID('4', { each: true })
  applicationIds!: string[];

  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  action!: ApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorNotes?: string;
}
