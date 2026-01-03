import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGenreDto {
  @ApiProperty({
    description: 'Genre name',
    example: 'Fantasy',
  })
  @IsString()
  @MaxLength(100)
  name!: string;
}
