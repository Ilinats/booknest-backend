import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApplicationDto {
  @IsUUID()
  bookId!: string;

  @IsOptional()
  @IsString()
  applicationMessage?: string;
}
