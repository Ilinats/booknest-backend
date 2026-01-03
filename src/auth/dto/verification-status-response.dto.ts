import { ApiProperty } from '@nestjs/swagger';

export class VerificationStatusResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  isActive!: boolean;
}
