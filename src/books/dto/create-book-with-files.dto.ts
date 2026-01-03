import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateBookDto } from './create-book.dto';

export class CreateBookWithFilesDto extends CreateBookDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Book file (e.g. PDF, EPUB). Required for digital or both distribution types.',
  })
  file?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Cover image file',
  })
  cover?: any;
}
