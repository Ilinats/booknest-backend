import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomSocialMediaDto {
  @ApiProperty()
  @IsString()
  platform: string;

  @ApiProperty()
  @IsString()
  @IsUrl()
  url: string;
}

export class SocialMediaDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomSocialMediaDto)
  custom?: CustomSocialMediaDto[] | null;
}
