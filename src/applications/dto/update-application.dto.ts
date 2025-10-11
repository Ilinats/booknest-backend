import { IsOptional, IsString } from 'class-validator';

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  applicationMessage?: string;
}
