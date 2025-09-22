import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @Length(1, 255)
  streetAddress!: string;

  @IsString()
  @Length(1, 100)
  city!: string;

  @IsString()
  @Length(1, 20)
  postalCode!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
