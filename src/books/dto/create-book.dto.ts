import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AgeRating, DistributionType, SelectionMethod } from '../enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  fullDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  pageCount?: number;

  @ApiPropertyOptional()
  @IsEnum(AgeRating)
  ageRating!: AgeRating;

  @ApiPropertyOptional()
  @IsEnum(DistributionType)
  distributionType!: DistributionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  totalCopies?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  availableCopies?: number;

  @ApiPropertyOptional()
  @IsDateString()
  applicationDeadline: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reviewDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  selectionCriteria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(SelectionMethod)
  selectionMethod?: SelectionMethod;

  @IsOptional()
  @ApiPropertyOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
        .filter((v) => !isNaN(v));
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed
            .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
            .filter((v) => !isNaN(v));
        }
      } catch {
        const parts = value.split(',').map((s) => s.trim());
        const numbers = parts
          .map((v) => parseInt(v, 10))
          .filter((v) => !isNaN(v));
        return numbers.length > 0 ? numbers : undefined;
      }
    }
    if (typeof value === 'number') {
      return [value];
    }
    return undefined;
  })
  @IsArray()
  @IsInt({ each: true })
  genres?: number[];

  @IsOptional()
  @ApiPropertyOptional()
  @IsUUID()
  seriesId?: string;

  @IsOptional()
  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  seriesOrder?: number;
}
