import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class CustomSocialMediaDto {
  @ApiProperty()
  @IsString()
  platform: string;

  @ApiProperty()
  @IsString()
  @IsUrl()
  url: string;
}
