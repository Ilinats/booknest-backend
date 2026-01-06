import { PartialType } from '@nestjs/swagger';
import { RegisterDeviceTokenDto } from './register-device-token.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDeviceTokenDto extends PartialType(RegisterDeviceTokenDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
