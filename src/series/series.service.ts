import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Series } from './entity/series.entity';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { SeriesErrorCode, SeriesErrors } from './errors/series-errors';
import { ensureAuthor } from '../common/utils/auth.util';
import { UserType } from '../users/enums';

@Injectable()
export class SeriesService {
  constructor(
    @InjectRepository(Series) private readonly seriesRepo: Repository<Series>,
  ) {}

  async create(
    authorId: string,
    userType: UserType | undefined,
    dto: CreateSeriesDto,
  ): Promise<Series> {
    ensureAuthor(userType);
    const entity = this.seriesRepo.create({
      authorId,
      name: dto.name,
      description: dto.description ?? null,
    });
    return await this.seriesRepo.save(entity);
  }

  async listMine(authorId: string): Promise<Series[]> {
    return await this.seriesRepo.find({
      where: { authorId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    authorId: string,
    userType: UserType | undefined,
    id: string,
    dto: UpdateSeriesDto & Partial<CreateSeriesDto>,
  ): Promise<Series> {
    ensureAuthor(userType);
    const s = await this.seriesRepo.findOne({ where: { id } });
    if (!s) {
      const error = SeriesErrors[SeriesErrorCode.SERIES_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }
    if (s.authorId !== authorId) {
      const error = SeriesErrors[SeriesErrorCode.SERIES_CANNOT_EDIT_OTHERS];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }
    const merged = this.seriesRepo.merge(s, {
      name: dto.name ?? s.name,
      description: dto.description ?? s.description,
    });
    return await this.seriesRepo.save(merged);
  }

  async remove(authorId: string, userType: UserType | undefined, id: string) {
    ensureAuthor(userType);
    const s = await this.seriesRepo.findOne({ where: { id } });
    if (!s) {
      const error = SeriesErrors[SeriesErrorCode.SERIES_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }
    if (s.authorId !== authorId) {
      const error = SeriesErrors[SeriesErrorCode.SERIES_CANNOT_DELETE_OTHERS];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }
    await this.seriesRepo.delete(id);
  }
}
