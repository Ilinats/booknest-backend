import { IsString, IsOptional, IsArray, ValidateNested, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomSocialMediaDto {
  @IsString()
  platform!: string;

  @IsString()
  @IsUrl()
  url!: string;
}

export class SocialMediaDto {
  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  @IsOptional()
  @IsString()
  youtube?: string;

  @IsOptional()
  @IsString()
  goodreads?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomSocialMediaDto)
  custom?: CustomSocialMediaDto[];
}
