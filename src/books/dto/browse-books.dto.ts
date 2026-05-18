import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Browse books — standard nestjs-paginate query params.
 * Most filters/sorts are applied by the library; only `filter.averageRating`
 * and sorts `mostPopular` / `averageRating` need a custom SQL path.
 */
export class BrowseBooksDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search book title, author name, or series name',
    example: 'enchanted',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'publishedAt:DESC | applicationDeadline:ASC | availableCopies:DESC | mostPopular:DESC | averageRating:DESC',
    example: 'publishedAt:DESC',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'One or more genres ($eq:4 or $in:13,18)',
    example: '$in:13,18',
  })
  @IsOptional()
  @IsString()
  'filter.bookGenres.genreId'?: string;

  @ApiPropertyOptional({ example: '$eq:13+' })
  @IsOptional()
  @IsString()
  'filter.ageRating'?: string;

  @ApiPropertyOptional({ example: '$eq:digital' })
  @IsOptional()
  @IsString()
  'filter.distributionType'?: string;

  @ApiPropertyOptional({
    description: 'Review rating range — triggers custom SQL',
    example: '$btw:3,5',
  })
  @IsOptional()
  @IsString()
  'filter.averageRating'?: string;

  @ApiPropertyOptional({
    description:
      'Accepting applications: copies > 0 and deadline in the future',
    example: '$gt:0',
  })
  @IsOptional()
  @IsString()
  'filter.availableCopies'?: string;

  @ApiPropertyOptional({
    description: 'Use $gt:now, $btw:from,to, or $lte:date',
    example: '$gt:2026-05-18T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  'filter.applicationDeadline'?: string;
}
