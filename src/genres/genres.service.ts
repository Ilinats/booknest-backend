import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Genre } from './entity/genre.entity';
import { CreateGenreDto } from './dto/create-genre.dto';

@Injectable()
export class GenresService {
  constructor(
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async create(dto: CreateGenreDto): Promise<Genre> {
    const existing = await this.genreRepository.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException({ message: 'Genre already exists', code: 'GENRE_EXISTS' });
    }
    const genre = this.genreRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      colorCode: dto.colorCode ?? null,
      icon: dto.icon ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.genreRepository.save(genre);
  }

  async findAll(): Promise<Genre[]> {
    return this.genreRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Genre> {
    const genre = await this.genreRepository.findOne({ where: { id } });
    if (!genre) {
      throw new NotFoundException({ message: 'Genre not found', code: 'GENRE_NOT_FOUND' });
    }
    return genre;
  }
}


