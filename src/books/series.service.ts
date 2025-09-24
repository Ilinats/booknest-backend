import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Series } from './entity/series.entity';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';

@Injectable()
export class SeriesService {
  constructor(@InjectRepository(Series) private readonly seriesRepo: Repository<Series>) {}

  private ensureAuthor(userType?: string) {
    if (userType !== 'author') throw new ForbiddenException('Author access required');
  }

  async create(authorId: string, userType: string | undefined, dto: CreateSeriesDto) {
    this.ensureAuthor(userType);
    const entity = this.seriesRepo.create({ authorId, name: dto.name, description: dto.description ?? null });
    return this.seriesRepo.save(entity);
  }

  async listMine(authorId: string) {
    return this.seriesRepo.find({ where: { authorId }, order: { createdAt: 'DESC' } });
  }

  async update(authorId: string, userType: string | undefined, id: string, dto: UpdateSeriesDto & Partial<CreateSeriesDto>) {
    this.ensureAuthor(userType);
    const s = await this.seriesRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Series not found');
    if (s.authorId !== authorId) throw new ForbiddenException('Cannot edit others series');
    const merged = this.seriesRepo.merge(s, { name: dto.name ?? s.name, description: dto.description ?? s.description });
    return this.seriesRepo.save(merged);
  }

  async remove(authorId: string, userType: string | undefined, id: string) {
    this.ensureAuthor(userType);
    const s = await this.seriesRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Series not found');
    if (s.authorId !== authorId) throw new ForbiddenException('Cannot delete others series');
    await this.seriesRepo.delete(id);
    return { success: true };
  }
}


