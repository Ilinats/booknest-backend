import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty()
  message!: string;
}
