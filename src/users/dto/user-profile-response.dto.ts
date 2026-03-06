import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class UserProfileResponseDto extends UserResponseDto {
  @ApiPropertyOptional()
  stats?: Record<string, unknown>;
}
