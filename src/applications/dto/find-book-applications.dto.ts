import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';
import { ApplicationSortBy } from '../enums/application-sort.enum';

type BasePaginationWithoutSortBy = Omit<BasePaginationDto, 'sortBy'>;

export class FindBookApplicationsDto extends (BasePaginationDto as any as new () => BasePaginationWithoutSortBy) {
  @ApiPropertyOptional({
    enum: ApplicationSortBy,
    description: 'Sort order for applications',
    default: ApplicationSortBy.APPLICATION_DATE,
  })
  @IsOptional()
  @IsEnum(ApplicationSortBy)
  sortBy?: ApplicationSortBy;

  @ApiPropertyOptional({
    enum: ['ASC', 'DESC'],
    description: 'Sort direction',
    default: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
