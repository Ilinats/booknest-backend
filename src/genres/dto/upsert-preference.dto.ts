import { IsInt, Max, Min } from 'class-validator';

export class UpsertPreferenceDto {
  @IsInt()
  genreId!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  preferenceLevel!: number;
}


