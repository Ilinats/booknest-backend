import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertPreferenceDto {
  @ApiProperty()
  @IsInt()
  genreId: number;
}
