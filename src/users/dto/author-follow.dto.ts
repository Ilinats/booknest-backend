import { IsString, IsNotEmpty } from 'class-validator';

export class FollowAuthorDto {
  @IsString()
  @IsNotEmpty()
  authorId!: string;
}

export class UnfollowAuthorDto {
  @IsString()
  @IsNotEmpty()
  authorId!: string;
}
