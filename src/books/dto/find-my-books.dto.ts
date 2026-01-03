import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorBookSortBy } from '../enums';

export class FindMyBooksDto {
  @ApiPropertyOptional({
    enum: AuthorBookSortBy,
    description: 'Sort order for author books',
    default: AuthorBookSortBy.DATE_CREATED,
  })
  @IsOptional()
  @IsEnum(AuthorBookSortBy)
  sortBy?: AuthorBookSortBy;
}

