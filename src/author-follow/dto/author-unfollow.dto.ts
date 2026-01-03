import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UnfollowAuthorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  authorId!: string;
}
