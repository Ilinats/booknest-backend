import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FollowAuthorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  authorId!: string;
}
