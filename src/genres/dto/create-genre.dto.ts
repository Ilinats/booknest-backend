import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGenreDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsHexColor()
  colorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}


