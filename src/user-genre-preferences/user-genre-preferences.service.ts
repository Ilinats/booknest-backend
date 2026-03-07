import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entity/user.entity';
import { Genre } from '../genres/entity/genre.entity';
import { UserGenrePreference } from './entity/user-genre-preference.entity';

@Injectable()
export class UserGenrePreferencesService {
  constructor(
    @InjectRepository(UserGenrePreference)
    private readonly prefRepository: Repository<UserGenrePreference>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async listForUser(userId: string): Promise<UserGenrePreference[]> {
    return this.prefRepository.find({
      where: { user: { id: userId } },
      relations: { genre: true },
    });

  async upsert(userId: string, genreId: number): Promise<UserGenrePreference> {
    const genre = await this.genreRepository.findOne({
      where: { id: genreId },
    });

    if (!genre) {
      throw new NotFoundException('Genre not found');
    }

    let pref = await this.prefRepository.findOne({
      where: { user: { id: userId }, genre: { id: genreId } },
      relations: { user: true, genre: true },
    });

    if (!pref) {
      const userRef = { id: userId } as User;
      pref = this.prefRepository.create({ user: userRef, genre });
    } else {
      pref.genre = genre;
    }

    return this.prefRepository.save(pref);
  }

  async remove(userId: string, genreId: number): Promise<void> {
    const pref = await this.prefRepository.findOne({
      where: { user: { id: userId }, genre: { id: genreId } },
    });

    if (!pref) {
      return;
    }

    await this.prefRepository.remove(pref);
  }
}
