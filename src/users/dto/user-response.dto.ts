import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from '../enums';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  email?: string;

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

  @ApiPropertyOptional()
  emailVerified?: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}
