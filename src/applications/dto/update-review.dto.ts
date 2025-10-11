import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsEnum(['link', 'text'] as const)
  reviewType?: 'link' | 'text';

  @IsOptional()
  @IsString()
  reviewContent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reviewUrls?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
