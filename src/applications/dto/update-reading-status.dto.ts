import { IsEnum } from 'class-validator';
import { ReadingStatus } from '../enums';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateReadingStatusDto {
  @ApiProperty({
    required: true,
    enum: ReadingStatus,
  })
  @IsEnum(ReadingStatus)
  readingStatus!: ReadingStatus;
}
