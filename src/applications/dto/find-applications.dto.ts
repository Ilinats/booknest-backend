import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';
import { ApplicationStatus, ReadingStatus } from '../enums';
import { AgeRating, DistributionType } from '../../books/enums';

export class FindApplicationsDto extends BasePaginationDto {
  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ enum: ReadingStatus })
  @IsOptional()
  @IsEnum(ReadingStatus)
  readingStatus?: ReadingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activeBooksOnly?: boolean;

  @ApiPropertyOptional({ enum: DistributionType })
  @IsOptional()
  @IsEnum(DistributionType)
  distributionType?: DistributionType;

  @ApiPropertyOptional({ enum: AgeRating })
  @IsOptional()
  @IsEnum(AgeRating)
  ageRating?: AgeRating;

  @ApiPropertyOptional({
    type: [Number],
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
}
