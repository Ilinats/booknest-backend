import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  identifier!: string; // username or email

  @IsString()
  @Length(8, 128)
  password!: string;
} 