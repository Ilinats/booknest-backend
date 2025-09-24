import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  fullDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  pageCount?: number;

  @IsOptional()
  @IsEnum(['all', '13+', '16+', '18+'] as const)
  ageRating?: 'all' | '13+' | '16+' | '18+';

  @IsOptional()
  @IsEnum(['physical', 'digital', 'both'] as const)
  distributionType?: 'physical' | 'digital' | 'both';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fileType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalCopies?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  availableCopies?: number;

  @IsOptional()
  @IsDateString()
  applicationDeadline?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  reviewDeadlineDays?: number;

  @IsOptional()
  @IsString()
  selectionCriteria?: string;

  @IsOptional()
  @IsEnum(['author_selects', 'first_come', 'lottery'] as const)
  selectionMethod?: 'author_selects' | 'first_come' | 'lottery';

  @IsOptional()
  @IsArray()
  genreIds?: number[];

  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seriesOrder?: number;
}


