import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
