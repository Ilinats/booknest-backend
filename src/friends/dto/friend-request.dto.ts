import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  username: string;
}

export class AcceptFriendRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  requesterId: string;
}

export class DeclineFriendRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  requesterId: string;
}

export class UnfriendDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  friendId: string;
}
