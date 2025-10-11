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
import { Application } from '../applications/entity/application.entity';
import { Review } from '../applications/entity/review.entity';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Series) private readonly seriesRepo: Repository<Series>,
    @InjectRepository(BookGenre) private readonly bookGenreRepo: Repository<BookGenre>,
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
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
        book.id = row.id;
        book.authorId = row.author_id;
        book.title = row.title;
        book.shortDescription = row.short_description;
        book.fullDescription = row.full_description;
        book.coverImageUrl = row.cover_image_url;
        book.pageCount = row.page_count;
        book.ageRating = row.age_rating;
        book.distributionType = row.distribution_type;
        book.fileUrl = row.file_url;
        book.fileSize = row.file_size;
        book.fileType = row.file_type;
        book.totalCopies = row.total_copies;
        book.availableCopies = row.available_copies;
        book.applicationDeadline = row.application_deadline;
        book.reviewDeadlineDays = row.review_deadline_days;
        book.selectionCriteria = row.selection_criteria;
        book.selectionMethod = row.selection_method;
        book.status = row.status;
        book.createdAt = row.created_at;
        book.updatedAt = row.updated_at;
        book.publishedAt = row.published_at;
        book.seriesId = row.series_id;
        book.seriesOrder = row.series_order;
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
    return { bookId, totalApplicants: 0, approvedReaders: 0 };
  }

  async analytics(authorId: string, bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.authorId !== authorId) throw new ForbiddenException('Cannot view analytics of others books');
    
    return this.getBookAnalytics(bookId);
  }

  async getBookAnalytics(bookId: string) {
    const [
      totalApplications,
      approvedApplications,
      pendingApplications,
      rejectedApplications,
      totalReviews,
      reviews,
      averageRating,
      ratingDistribution,
      reviewTypes,
      averageWordCount,
      recentReviews
    ] = await Promise.all([
      this.applicationRepo.count({ where: { bookId } }),
      this.applicationRepo.count({ where: { bookId, status: 'approved' } }),
      this.applicationRepo.count({ where: { bookId, status: 'pending' } }),
      this.applicationRepo.count({ where: { bookId, status: 'rejected' } }),
      this.reviewRepo.count({ 
        where: { 
          application: { bookId },
          isPublic: true 
        } 
      }),
      this.reviewRepo.find({ 
        where: { 
          application: { bookId },
          isPublic: true 
        },
        relations: ['application', 'application.reader']
      }),
      this.getAverageRating(bookId),
      this.getRatingDistribution(bookId),
      this.getReviewTypes(bookId),
      this.getAverageWordCount(bookId),
      this.getRecentReviews(bookId, 5)
    ]);

    const positiveFeedback = reviews.length > 0 
      ? Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100)
      : 0;

    return {
      bookId,
      summary: {
        totalApplications,
        approvedApplications,
        pendingApplications,
        rejectedApplications,
        totalReviews,
        averageRating,
        positiveFeedback
      },
      reviewAnalytics: {
        totalReviews,
        averageRating,
        positiveFeedback,
        ratingDistribution,
        reviewTypes,
        averageWordCount
      },
      applicationAnalytics: {
        totalApplications,
        approvedApplications,
        pendingApplications,
        rejectedApplications,
        approvalRate: totalApplications > 0 ? Math.round((approvedApplications / totalApplications) * 100) : 0,
        rejectionRate: totalApplications > 0 ? Math.round((rejectedApplications / totalApplications) * 100) : 0
      },
      recentReviews
    };
  }

  private async getAverageRating(bookId: string): Promise<number> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('AVG(review.rating)', 'average')
      .where('application.bookId = :bookId', { bookId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .getRawOne();

    return result?.average ? parseFloat(parseFloat(result.average).toFixed(1)) : 0;
  }

  private async getRatingDistribution(bookId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('application.bookId = :bookId', { bookId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .groupBy('review.rating')
      .orderBy('review.rating', 'ASC')
      .getRawMany();


    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    result.forEach(row => {
      distribution[row.rating] = parseInt(row.count);
    });

    return distribution;
  }

  private async getReviewTypes(bookId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('review.reviewType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('application.bookId = :bookId', { bookId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .groupBy('review.reviewType')
      .getRawMany();

    const types = { text: 0, link: 0 };
    result.forEach(row => {
      types[row.type] = parseInt(row.count);
    });

    return types;
  }

  private async getAverageWordCount(bookId: string): Promise<number> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('AVG(review.wordCount)', 'average')
      .where('application.bookId = :bookId', { bookId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .andWhere('review.wordCount IS NOT NULL')
      .getRawOne();

    return result?.average ? Math.round(parseFloat(result.average)) : 0;
  }

  private async getRecentReviews(bookId: string, limit: number = 5) {
    return this.reviewRepo.find({
      where: { 
        application: { bookId },
        isPublic: true 
      },
      relations: ['application', 'application.reader'],
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  async getAuthorAnalytics(authorId: string) {
    const [
      totalBooks,
      publishedBooks,
      totalApplications,
      approvedApplications,
      totalReviews,
      averageRating,
      booksWithReviews,
      topPerformingBooks
    ] = await Promise.all([
      this.bookRepo.count({ where: { authorId } }),
      this.bookRepo.count({ where: { authorId, status: 'active' } }),
      this.applicationRepo.count({ 
        where: { book: { authorId } } 
      }),
      this.applicationRepo.count({ 
        where: { book: { authorId }, status: 'approved' } 
      }),
      this.reviewRepo.count({ 
        where: { 
          application: { book: { authorId } },
          isPublic: true 
        } 
      }),
      this.getAuthorAverageRating(authorId),
      this.getBooksWithReviews(authorId),
      this.getTopPerformingBooks(authorId, 5)
    ]);

    const overallApprovalRate = totalApplications > 0 
      ? Math.round((approvedApplications / totalApplications) * 100) 
      : 0;

    return {
      authorId,
      overview: {
        totalBooks,
        publishedBooks,
        draftBooks: totalBooks - publishedBooks,
        totalApplications,
        approvedApplications,
        totalReviews,
        averageRating,
        overallApprovalRate
      },
      performance: {
        booksWithReviews,
        averageRating,
        topPerformingBooks
      },
      trends: {
        monthlyApplications: await this.getMonthlyApplications(authorId),
        monthlyReviews: await this.getMonthlyReviews(authorId)
      }
    };
  }

  private async getAuthorAverageRating(authorId: string): Promise<number> {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('AVG(review.rating)', 'average')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .getRawOne();

    return result?.average ? parseFloat(parseFloat(result.average).toFixed(1)) : 0;
  }

  private async getBooksWithReviews(authorId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('COUNT(DISTINCT application.bookId)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .getRawOne();

    return parseInt(result?.count || '0');
  }

  private async getTopPerformingBooks(authorId: string, limit: number = 5) {
    return this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('book.id', 'bookId')
      .addSelect('book.title', 'title')
      .addSelect('AVG(review.rating)', 'averageRating')
      .addSelect('COUNT(review.id)', 'reviewCount')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .groupBy('book.id, book.title')
      .orderBy('averageRating', 'DESC')
      .addOrderBy('reviewCount', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  private async getMonthlyApplications(authorId: string) {
    const result = await this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select('DATE_TRUNC(\'month\', application.appliedAt)', 'month')
      .addSelect('COUNT(*)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('application.appliedAt >= :sixMonthsAgo', { 
        sixMonthsAgo: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) 
      })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    return result.map(row => ({
      month: row.month,
      count: parseInt(row.count)
    }));
  }

  private async getMonthlyReviews(authorId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('DATE_TRUNC(\'month\', review.createdAt)', 'month')
      .addSelect('COUNT(*)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .andWhere('review.createdAt >= :sixMonthsAgo', { 
        sixMonthsAgo: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) 
      })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    return result.map(row => ({
      month: row.month,
      count: parseInt(row.count)
    }));
  }
}


