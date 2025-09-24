import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entity/book.entity';
import { Series } from './entity/series.entity';
import { BookGenre } from './entity/book-genre.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Series) private readonly seriesRepo: Repository<Series>,
    @InjectRepository(BookGenre) private readonly bookGenreRepo: Repository<BookGenre>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private ensureAuthor(authorUserType?: string) {
    if (authorUserType !== 'author') {
      throw new ForbiddenException('Author access required');
    }
  }

  async create(authorId: string, authorUserType: string | undefined, dto: CreateBookDto) {
    this.ensureAuthor(authorUserType);
    await this.ensureSeriesOwnershipIfProvided(authorId, dto.seriesId);
    const totalCopies = dto.totalCopies ?? 1;
    const availableCopies = dto.availableCopies ?? totalCopies;
    if (availableCopies > totalCopies || availableCopies < 0) {
      throw new ForbiddenException('availableCopies must be between 0 and totalCopies');
    }
    const book = this.bookRepo.create({
      authorId,
      title: dto.title,
      shortDescription: dto.shortDescription ?? null,
      fullDescription: dto.fullDescription ?? null,
      coverImageUrl: dto.coverImageUrl ?? null,
      pageCount: dto.pageCount ?? null,
      ageRating: dto.ageRating,
      distributionType: dto.distributionType,
      fileUrl: dto.fileUrl ?? null,
      fileSize: dto.fileSize?.toString() ?? null,
      fileType: dto.fileType ?? null,
      totalCopies,
      availableCopies,
      applicationDeadline: new Date(dto.applicationDeadline),
      reviewDeadlineDays: dto.reviewDeadlineDays ?? 30,
      selectionCriteria: dto.selectionCriteria ?? null,
      selectionMethod: dto.selectionMethod ?? 'author_selects',
      seriesId: dto.seriesId ?? null,
      seriesOrder: dto.seriesOrder ?? null,
    });
    const saved = await this.bookRepo.save(book);
    if (dto.genreIds?.length) {
      const bgs = dto.genreIds.map((gid) => this.bookGenreRepo.create({ bookId: saved.id, genreId: gid }));
      await this.bookGenreRepo.save(bgs);
    }
    return this.findOnePublic(saved.id);
  }

  async ensureSeriesOwnershipIfProvided(authorId: string, seriesId?: string) {
    if (!seriesId) return;
    const series = await this.seriesRepo.findOne({ where: { id: seriesId } });
    if (!series || series.authorId !== authorId) {
      throw new ForbiddenException('Series not found or not owned by author');
    }
  }

  async findMy(authorId: string) {
    return this.bookRepo.find({ where: { authorId }, order: { createdAt: 'DESC' } });
  }

  async findOnePublic(bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async update(
    authorId: string,
    authorUserType: string | undefined,
    bookId: string,
    dto: UpdateBookDto & Partial<CreateBookDto>,
  ) {
    this.ensureAuthor(authorUserType);
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.authorId !== authorId) throw new ForbiddenException('Cannot modify others books');
    await this.ensureSeriesOwnershipIfProvided(authorId, dto.seriesId);
    const merged = this.bookRepo.merge(book, {
      title: dto.title ?? book.title,
      shortDescription: dto.shortDescription ?? book.shortDescription,
      fullDescription: dto.fullDescription ?? book.fullDescription,
      coverImageUrl: dto.coverImageUrl ?? book.coverImageUrl,
      pageCount: dto.pageCount ?? book.pageCount,
      ageRating: dto.ageRating ?? book.ageRating,
      distributionType: dto.distributionType ?? book.distributionType,
      fileUrl: dto.fileUrl ?? book.fileUrl,
      fileSize: dto.fileSize !== undefined ? dto.fileSize.toString() : book.fileSize,
      fileType: dto.fileType ?? book.fileType,
      totalCopies: dto.totalCopies ?? book.totalCopies,
      availableCopies: dto.availableCopies ?? book.availableCopies,
      applicationDeadline: dto.applicationDeadline ? new Date(dto.applicationDeadline) : book.applicationDeadline,
      reviewDeadlineDays: dto.reviewDeadlineDays ?? book.reviewDeadlineDays,
      selectionCriteria: dto.selectionCriteria ?? book.selectionCriteria,
      selectionMethod: dto.selectionMethod ?? book.selectionMethod,
      seriesId: dto.seriesId ?? book.seriesId,
      seriesOrder: dto.seriesOrder ?? book.seriesOrder,
    });
    if (merged.availableCopies > merged.totalCopies || merged.availableCopies < 0) {
      throw new ForbiddenException('availableCopies must be between 0 and totalCopies');
    }
    await this.bookRepo.save(merged);
    if (dto.genreIds) {
      // replace genres
      await this.bookGenreRepo.delete({ bookId: bookId });
      if (dto.genreIds.length) {
        const bgs = dto.genreIds.map((gid) => this.bookGenreRepo.create({ bookId, genreId: gid }));
        await this.bookGenreRepo.save(bgs);
      }
    }
    return this.findOnePublic(bookId);
  }

  async remove(authorId: string, authorUserType: string | undefined, bookId: string) {
    this.ensureAuthor(authorUserType);
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.authorId !== authorId) throw new ForbiddenException('Cannot delete others books');
    await this.bookRepo.delete(bookId);
    return { success: true };
  }

  async publish(authorId: string, authorUserType: string | undefined, bookId: string) {
    this.ensureAuthor(authorUserType);
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.authorId !== authorId) throw new ForbiddenException('Cannot publish others books');
    book.status = 'active';
    book.publishedAt = new Date();
    await this.bookRepo.save(book);
    return this.findOnePublic(bookId);
  }

  async browse(params: { status?: string; search?: string; genreId?: number; ageRating?: string; distributionType?: string; publishedFrom?: string; publishedTo?: string; skip?: number; take?: number }) {
    const qb = this.bookRepo.createQueryBuilder('b');
    qb.where('b.status = :status', { status: params.status ?? 'active' });
    if (params.search) {
      qb.andWhere('(b.title ILIKE :q OR b.short_description ILIKE :q)', { q: `%${params.search}%` });
    }
    if (params.genreId) {
      qb.innerJoin('book_genres', 'bg', 'bg.book_id = b.id AND bg.genre_id = :gid', { gid: params.genreId });
    }
    if (params.ageRating) {
      qb.andWhere('b.age_rating = :age', { age: params.ageRating });
    }
    if (params.distributionType) {
      qb.andWhere('b.distribution_type = :dist', { dist: params.distributionType });
    }
    if (params.publishedFrom) {
      qb.andWhere('b.published_at >= :from', { from: params.publishedFrom });
    }
    if (params.publishedTo) {
      qb.andWhere('b.published_at <= :to', { to: params.publishedTo });
    }
    qb.orderBy('b.published_at', 'DESC', 'NULLS LAST');
    if (params.skip !== undefined) qb.skip(params.skip);
    if (params.take !== undefined) qb.take(params.take);
    return qb.getMany();
  }

  async featured() {
    // Simple placeholder: latest active books
    console.log('Fetching featured books...');
    const books = await this.bookRepo.find({ 
      where: { status: 'active' }, 
      order: { publishedAt: 'DESC' }, 
      take: 10 
    });
    console.log('Featured books found:', books.length);
    console.log('Featured books:', books.map(b => ({ id: b.id, title: b.title, status: b.status, publishedAt: b.publishedAt })));
    return books;
  }

  async recommendedForUser(userId: string, opts?: { skip?: number; take?: number }) {
    try {
      console.log('Recommending for user:', userId);
      console.log('Opts:', opts);
      
      const qb = this.bookRepo.createQueryBuilder('b');
      qb.innerJoin('book_genres', 'bg', 'bg.book_id = b.id')
        .innerJoin('user_genre_preferences', 'ugp', 'ugp.genre_id = bg.genre_id AND ugp.user_id = :uid', { uid: userId })
        .where('b.status = :status', { status: 'active' })
        .groupBy('b.id')
        .addSelect('SUM(ugp.preference_level)', 'score')
        .orderBy('score', 'DESC')
        .addOrderBy('b.published_at', 'DESC', 'NULLS LAST');
      if (opts?.skip !== undefined) qb.skip(opts.skip);
      if (opts?.take !== undefined) qb.take(opts.take);
      
      const query = `
        SELECT b.*, SUM(ugp.preference_level) as score
        FROM books b
        INNER JOIN book_genres bg ON bg.book_id = b.id
        INNER JOIN user_genre_preferences ugp ON ugp.genre_id = bg.genre_id AND ugp.user_id = $1
        WHERE b.status = $2
        GROUP BY b.id
        ORDER BY score DESC, b.published_at DESC NULLS LAST
        ${opts?.take ? `LIMIT ${opts.take}` : ''}
        ${opts?.skip ? `OFFSET ${opts.skip}` : ''}
      `;
      
      const results = await this.dataSource.query(query, [userId, 'active']);
      
      if (results.length === 0) {
        console.log('No personalized recommendations found, falling back to featured books');
        return this.featured();
      }
      
      const books = results.map(row => {
        const book = new Book();
        Object.assign(book, row);
        return book;
      });
      
      console.log('Recommended books found:', books.length);
      return books;
    } catch (error) {
      console.error('Error in recommendedForUser:', error);
      console.error('Error stack:', error.stack);
      
      console.log('Falling back to featured books due to error');
      return this.featured();
    }
  }

  async stats(authorId: string, bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.authorId !== authorId) throw new ForbiddenException('Cannot view stats of others books');
    // Placeholder stats
    return { bookId, totalApplicants: 0, approvedReaders: 0 };
  }

  async analytics(authorId: string, bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.authorId !== authorId) throw new ForbiddenException('Cannot view analytics of others books');
    // Placeholder analytics
    return { bookId, views: 0, clicks: 0 };
  }
}


