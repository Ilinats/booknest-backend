import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class FindNotificationsDto extends BasePaginationDto {
  @ApiPropertyOptional({ description: 'Only return unread notifications' })
  @IsOptional()
  @Transform(({ value, obj, key }) => {
    const rawValue = obj?.[key] ?? value;

    console.log(
      '[FindNotificationsDto] Transform unreadOnly, raw value:',
      rawValue,
      'type:',
      typeof rawValue,
      'obj[key]:',
      obj?.[key],
      'value:',
      value,
    );

    if (rawValue === 'true' || rawValue === '1' || rawValue === true)
      return true;
    if (
      rawValue === 'false' ||
      rawValue === '0' ||
      rawValue === '' ||
      rawValue === false
    )
      return false;

    if (rawValue === undefined || rawValue === null) return undefined;

    return Boolean(rawValue);
  })
  @IsBoolean()
  unreadOnly?: boolean;
}
