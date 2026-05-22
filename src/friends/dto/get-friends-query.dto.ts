import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  FriendRequestType,
  FriendStatus,
  FriendsListSortBy,
} from '../enums';

export class GetFriendsQueryDto {
  @ApiPropertyOptional({
    enum: FriendStatus,
    default: FriendStatus.ACCEPTED,
    description: 'accepted: friends list. pending: friend requests.',
  })
  @IsOptional()
  @IsEnum(FriendStatus)
  status?: FriendStatus;

  @ApiPropertyOptional({
    enum: FriendRequestType,
    default: FriendRequestType.RECEIVED,
    description: 'When status=pending: sent or received requests.',
  })
  @IsOptional()
  @IsEnum(FriendRequestType)
  type?: FriendRequestType;

  @ApiPropertyOptional({
    enum: FriendsListSortBy,
    description: 'Only applies when status=accepted.',
  })
  @IsOptional()
  @IsEnum(FriendsListSortBy)
  sortBy?: FriendsListSortBy;
}
