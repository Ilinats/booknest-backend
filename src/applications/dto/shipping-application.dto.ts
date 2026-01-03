import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShippingAddressDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  streetAddress!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  isPrimary!: boolean;
}

export class ShippingApplicationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  readerId!: string;

  @ApiProperty()
  readerFirstName!: string;

  @ApiProperty()
  readerLastName!: string;

  @ApiPropertyOptional()
  readerEmail?: string;

  @ApiProperty()
  applicationMessage?: string | null;

  @ApiProperty()
  authorNotes?: string | null;

  @ApiPropertyOptional()
  copySentAt?: Date | null;

  @ApiPropertyOptional()
  respondedAt?: Date | null;

  @ApiProperty()
  appliedAt!: Date;

  @ApiPropertyOptional()
  address?: ShippingAddressDto | null;
}
