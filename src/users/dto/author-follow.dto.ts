import { IsString, IsNotEmpty } from 'class-validator';

export class FollowAuthorDto {
  @IsString()
  @IsNotEmpty()
  username!: string;
}

export class UnfollowAuthorDto {
  @IsString()
  @IsNotEmpty()
  authorId!: string;
}
