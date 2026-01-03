import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from '../enums';

export class UserPublicResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ enum: UserType })
  userType!: UserType;

  @ApiPropertyOptional()
  bio?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
