import { ApiProperty } from '@nestjs/swagger';
import { UserPublicResponseDto } from './user-public-response.dto';

export class UserListResponseDto {
  @ApiProperty({ type: [UserPublicResponseDto] })
  data!: UserPublicResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 0 })
  skip!: number;

  @ApiProperty({ example: 20 })
  take!: number;

  @ApiProperty({ example: true })
  hasMore!: boolean;
}
