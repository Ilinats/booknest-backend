import { IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomSocialMediaDto } from './custom-social-media.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSocialMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tiktok?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  youtube?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goodreads?: string;

  @ApiPropertyOptional({ type: [CustomSocialMediaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomSocialMediaDto)
  custom?: CustomSocialMediaDto[];
}
