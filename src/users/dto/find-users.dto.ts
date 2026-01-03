import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { BasePaginationDto } from '../../common/dto';

export class FindUsersDto extends BasePaginationDto {
  @ApiPropertyOptional({
    description:
      'Filter by active status. If omitted, returns both active and inactive users.',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
