import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty()
  @IsString()
  identifier!: string; // username or email

  @ApiProperty()
  @IsString()
  @Length(8, 128)
  password!: string;
}
