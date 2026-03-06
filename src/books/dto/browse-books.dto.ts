import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationDto } from '../../common/dto';
import {
  BookStatus,
  AgeRating,
  DistributionType,
  BookSortBy,
  ApplicationStatusFilter,
  DeadlineFilter,
} from '../enums';

type BasePaginationWithoutSortByAndSearch = Omit<
  BasePaginationDto,
  'sortBy' | 'search'
>;

export class BrowseBooksDto extends (BasePaginationDto as any as new () => BasePaginationWithoutSortByAndSearch) {
  @ApiPropertyOptional({
    description:
      'Filter by genres (genre IDs) - accepts single number or array of numbers',
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
        .filter((v) => !isNaN(v));
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? undefined : [parsed];
    }
    if (typeof value === 'number') {
      return [value];
    }
    return undefined;
  })
  @IsArray()
  @IsInt({ each: true })
  genres?: number[];

  @ApiPropertyOptional({ enum: BookStatus })
  @IsOptional()
  @IsEnum(BookStatus)
  status?: BookStatus;

  @ApiPropertyOptional({ enum: AgeRating })
  @IsOptional()
  @IsEnum(AgeRating)
  ageRating?: AgeRating;

  @ApiPropertyOptional({ enum: DistributionType })
  @IsOptional()
  @IsEnum(DistributionType)
  distributionType?: DistributionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seriesName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seriesId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publishedFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publishedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  minAvgRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  maxAvgRating?: number;

  @ApiPropertyOptional({
    description:
      'Search query - searches across title, description, author, series, and genres',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ApplicationStatusFilter,
    description:
      'Filter by application status - accepting applications only or all books',
  })
  @IsOptional()
  @IsEnum(ApplicationStatusFilter)
  applicationStatus?: ApplicationStatusFilter;

  @ApiPropertyOptional({
    enum: DeadlineFilter,
    description:
      'Filter by deadline urgency - ending soon (within 7 days) or still time',
  })
  @IsOptional()
  @IsEnum(DeadlineFilter)
  deadlineFilter?: DeadlineFilter;

  @ApiPropertyOptional({
    enum: BookSortBy,
    description: 'Sort order for results',
  })
  @IsOptional()
  @IsEnum(BookSortBy)
  sortBy?: BookSortBy;
}
