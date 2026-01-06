import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty()
  @IsUUID()
  bookId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applicationMessage?: string;
}
