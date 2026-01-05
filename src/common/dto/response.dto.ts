import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BaseResponseDto<TData = any> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiPropertyOptional({ example: 'Operation completed successfully' })
  message?: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @ApiPropertyOptional({ description: 'Response payload' })
  data?: TData;
}

export class PaginatedResponseDto<TItem = any> extends BaseResponseDto<
  TItem[]
> {
  @ApiProperty({ example: 0 })
  skip!: number;

  @ApiProperty({ example: 20 })
  take!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: true })
  hasMore!: boolean;
}

