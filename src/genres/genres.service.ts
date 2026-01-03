import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Genre } from './entity/genre.entity';
import { CreateGenreDto } from './dto/create-genre.dto';
import { GenreErrorCode, GenreErrors } from './errors/genre-errors';

@Injectable()
export class GenresService {
  constructor(
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async create(dto: CreateGenreDto): Promise<Genre> {
    const existing = await this.genreRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      const error = GenreErrors[GenreErrorCode.GENRE_ALREADY_EXISTS];
      throw new ConflictException({ message: error.message, code: error.code });
    }
    const genre = this.genreRepository.create({ name: dto.name });
    return this.genreRepository.save(genre);
  }

  async findAll(): Promise<Genre[]> {
    return await this.genreRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Genre> {
    const genre = await this.genreRepository.findOne({ where: { id } });
    if (!genre) {
      const error = GenreErrors[GenreErrorCode.GENRE_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }
    return genre;
  }

  async findByName(name: string): Promise<Genre | null> {
    return await this.genreRepository.findOne({ where: { name } });
  }

  async findByIds(ids: number[]): Promise<Genre[]> {
    return await this.genreRepository.find({ where: { id: In(ids) } });
  }

  async findByNameOrNames(names: string[]): Promise<Genre[]> {
    return await this.genreRepository.find({ where: { name: In(names) } });
  }

  async getGenreIdsByNames(names: string[]): Promise<number[]> {
    const genres = await this.findByNameOrNames(names);
    return genres.map((g) => g.id);
  }
}
