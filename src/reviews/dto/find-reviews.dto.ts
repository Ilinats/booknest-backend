import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class FindReviewsDto extends BasePaginationDto {
  @ApiPropertyOptional({
    description:
      'Only used by GET /reviews/users/:userId. Book reviews use role-based visibility instead.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includePrivate?: boolean;
}
