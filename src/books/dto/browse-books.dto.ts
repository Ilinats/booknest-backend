import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BrowseBooksDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  genreId?: number;

  @IsOptional()
  @IsEnum(['draft', 'active', 'in_progress', 'completed', 'archived'] as const)
  status?: 'draft' | 'active' | 'in_progress' | 'completed' | 'archived';

  @IsOptional()
  @IsEnum(['all', '13+', '16+', '18+'] as const)
  ageRating?: 'all' | '13+' | '16+' | '18+';

  @IsOptional()
  @IsEnum(['physical', 'digital', 'both'] as const)
  distributionType?: 'physical' | 'digital' | 'both';

  @IsOptional()
  @IsString()
  publishedFrom?: string;

  @IsOptional()
  @IsString()
  publishedTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}


