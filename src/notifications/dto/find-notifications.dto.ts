import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class FindNotificationsDto extends BasePaginationDto {
  @ApiPropertyOptional({ description: 'Only return unread notifications' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    const normalized =
      typeof value === 'string' ? value.toLowerCase().trim() : String(value);

    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0') {
      return false;
    }

    return undefined;
  })
  @IsBoolean()
  unreadOnly?: boolean;
}
