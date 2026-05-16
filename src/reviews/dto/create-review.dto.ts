import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ReviewType } from '../enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty()
  @IsUUID()
  applicationId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating: number;

  @ApiProperty()
  @IsEnum(ReviewType)
  reviewType: ReviewType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reviewUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
