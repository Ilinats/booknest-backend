import { IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}
