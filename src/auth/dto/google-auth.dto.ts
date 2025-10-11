import { IsString, IsOptional, IsEnum } from 'class-validator';

export class GoogleAuthCallbackDto {
  @IsString()
  googleId!: string;

  @IsString()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(['reader', 'author'])
  userType?: 'reader' | 'author';
}
