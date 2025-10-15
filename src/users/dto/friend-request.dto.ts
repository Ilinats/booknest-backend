import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SendFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  username!: string;
}

export class AcceptFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  requesterId!: string;
}

export class DeclineFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  requesterId!: string;
}

export class UnfriendDto {
  @IsString()
  @IsNotEmpty()
  friendId!: string;
}

export class BlockUserDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class UnblockUserDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
