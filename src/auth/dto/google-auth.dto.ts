import { IsString, IsOptional, IsEnum } from 'class-validator';
import { UserType } from '../../users/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleAuthCallbackDto {
  @ApiProperty()
  @IsString()
  googleId!: string;

  @ApiProperty()
  @IsString()
  email!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;
}
