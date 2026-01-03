import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {
  @ApiProperty()
  @IsString()
  @Length(1, 255)
  streetAddress: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiProperty()
  @IsString()
  @Length(1, 20)
  postalCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
