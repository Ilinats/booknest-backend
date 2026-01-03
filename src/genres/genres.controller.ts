import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GenresService } from './genres.service';
import { Genre } from './entity/genre.entity';

@ApiTags('Genres')
@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Get()
  @ApiOperation({ summary: 'Get all genres' })
  @ApiResponse({ status: 200, description: 'List of genres', type: [Genre] })
  findAll() {
    return this.genresService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get genre by ID' })
  @ApiResponse({ status: 200, description: 'Genre details', type: Genre })
  @ApiResponse({ status: 404, description: 'Genre not found' })
  findOne(@Param('id', new ParseIntPipe()) id: number) {
    return this.genresService.findOne(id);
  }
}
