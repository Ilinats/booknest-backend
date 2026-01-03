import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkMarkSentDto {
  @ApiProperty()
  @IsArray()
  @IsUUID('4', { each: true })
  applicationIds!: string[];
}
