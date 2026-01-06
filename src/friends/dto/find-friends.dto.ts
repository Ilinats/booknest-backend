import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';
import { FriendRequestType, FriendStatus } from '../enums';

export class FindFriendsDto extends BasePaginationDto {
  @ApiPropertyOptional({ enum: FriendStatus })
  @IsOptional()
  @IsEnum(FriendStatus)
  status?: FriendStatus;
}

export class FindFriendRequestsDto extends BasePaginationDto {
  @ApiPropertyOptional({ enum: FriendRequestType })
  @IsOptional()
  @IsEnum(FriendRequestType)
  type?: FriendRequestType;
}

export class SearchUsersDto extends BasePaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  q?: string;
}
