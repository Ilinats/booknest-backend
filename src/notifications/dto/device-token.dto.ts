import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class UpdateDeviceTokenDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

