import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  applicationId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsEnum(['link', 'text'] as const)
  reviewType!: 'link' | 'text';

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
