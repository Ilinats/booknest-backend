import {
  IsInt,
  IsOptional,
  Max,
  Min,
  IsString,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BasePaginationDto {
  @ApiPropertyOptional({
    description: 'Number of items to skip',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of items to take',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort results as array of [field, direction] pairs',
    type: [String],
    example: [['createdAt', 'DESC']],
    required: false,
  })
  @IsOptional()
  @IsArray()
  sortBy?: [string, string][];

  @ApiPropertyOptional({
    description: 'Search term to apply for this collection',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
