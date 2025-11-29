import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entity/book.entity';
import { Series } from './entity/series.entity';
import { BookGenre } from './entity/book-genre.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookSummaryDto } from './dto/book-summary.dto';
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
    try {
      const query = `
        SELECT 
          b.*,
          u.first_name,
          u.last_name,
          u.bio,
          u.avatar_url,
          s.name as series_name,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', g.id,
              'name', g.name,
              'description', g.description
            )
          ) FILTER (WHERE g.id IS NOT NULL) as genres
        FROM books b
        INNER JOIN users u ON u.id = b.author_id
        LEFT JOIN series s ON s.id = b.series_id
        LEFT JOIN book_genres bg ON bg.book_id = b.id
        LEFT JOIN genres g ON g.id = bg.genre_id
        WHERE b.id = $1
        GROUP BY b.id, u.first_name, u.last_name, u.bio, u.avatar_url, s.name
      `;
      
      const results = await this.dataSource.query(query, [bookId]);
      if (results.length === 0) throw new NotFoundException('Book not found');
      
      const row = results[0];
      return {
        id: row.id,
        title: row.title,
        shortDescription: row.short_description,
        fullDescription: row.full_description,
        coverImageUrl: row.cover_image_url,
        pageCount: row.page_count,
        ageRating: row.age_rating,
        distributionType: row.distribution_type,
        totalCopies: row.total_copies,
        availableCopies: row.available_copies,
        applicationDeadline: row.application_deadline,
        reviewDeadlineDays: row.review_deadline_days,
        selectionCriteria: row.selection_criteria,
        selectionMethod: row.selection_method,
        status: row.status,
        fileUrl: row.file_url,
        fileSize: row.file_size,
        fileType: row.file_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        seriesId: row.series_id,
        seriesOrder: row.series_order,
        seriesName: row.series_name,
        genres: row.genres || [],
        author: {
          id: row.author_id,
          name: `${row.first_name} ${row.last_name}`,
          bio: row.bio,
          profilePictureUrl: row.avatar_url
        }
      };
    } catch (error) {
      console.error('Error in findOnePublic:', error);
      throw error;
    }
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
    let query = `
      SELECT 
        b.id,
        b.title,
        b.cover_image_url,
        b.published_at,
        b.series_id,
        b.series_order,
        u.first_name,
        u.last_name,
        s.name as series_name,
        AVG(r.rating) as avg_rating
      FROM books b
      INNER JOIN users u ON u.id = b.author_id
      LEFT JOIN series s ON s.id = b.series_id
      LEFT JOIN reviews r ON r.application_id IN (
        SELECT a.id FROM applications a WHERE a.book_id = b.id
      )
      WHERE b.status = $1
    `;
    
    const queryParams: any[] = [params.status ?? 'active'];
    let paramIndex = 2;
    
    if (params.search) {
      query += ` AND (b.title ILIKE $${paramIndex} OR b.short_description ILIKE $${paramIndex})`;
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }
    
    if (params.genreId) {
      query += ` AND EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = b.id AND bg.genre_id = $${paramIndex})`;
      queryParams.push(params.genreId);
      paramIndex++;
    }
    
    if (params.ageRating) {
      query += ` AND b.age_rating = $${paramIndex}`;
      queryParams.push(params.ageRating);
      paramIndex++;
    }
    
    if (params.distributionType) {
      query += ` AND b.distribution_type = $${paramIndex}`;
      queryParams.push(params.distributionType);
      paramIndex++;
    }
    
    if (params.publishedFrom) {
      query += ` AND b.published_at >= $${paramIndex}`;
      queryParams.push(params.publishedFrom);
      paramIndex++;
    }
    
    if (params.publishedTo) {
      query += ` AND b.published_at <= $${paramIndex}`;
      queryParams.push(params.publishedTo);
      paramIndex++;
    }
    
    query += `
      GROUP BY b.id, u.first_name, u.last_name, s.name
      ORDER BY b.published_at DESC NULLS LAST
    `;
    
    if (params.take !== undefined) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(params.take);
      paramIndex++;
    }
    
    if (params.skip !== undefined) {
      query += ` OFFSET $${paramIndex}`;
      queryParams.push(params.skip);
    }
    
    const results = await this.dataSource.query(query, queryParams);
    
    return results.map(row => ({
      id: row.id,
      title: row.title,
      authorName: `${row.first_name} ${row.last_name}`,
      coverImageUrl: row.cover_image_url,
      rating: row.avg_rating ? Math.round(row.avg_rating * 10) / 10 : null,
      seriesName: row.series_name,
      seriesOrder: row.series_order,
      publishedAt: row.published_at,
    })) as BookSummaryDto[];
  }

  async featured() {
    console.log('Fetching featured books...');
    const query = `
      SELECT 
        b.id,
        b.title,
        b.cover_image_url,
        b.published_at,
        b.series_id,
        b.series_order,
        u.first_name,
        u.last_name,
        s.name as series_name,
        AVG(r.rating) as avg_rating
      FROM books b
      INNER JOIN users u ON u.id = b.author_id
      LEFT JOIN series s ON s.id = b.series_id
      LEFT JOIN reviews r ON r.application_id IN (
        SELECT a.id FROM applications a WHERE a.book_id = b.id
      )
      WHERE b.status = 'active'
      GROUP BY b.id, u.first_name, u.last_name, s.name
      ORDER BY b.published_at DESC NULLS LAST
      LIMIT 10
    `;
    
    const results = await this.dataSource.query(query);
    
    const books: BookSummaryDto[] = results.map(row => ({
      id: row.id,
      title: row.title,
      authorName: `${row.first_name} ${row.last_name}`,
      coverImageUrl: row.cover_image_url,
      rating: row.avg_rating ? Math.round(row.avg_rating * 10) / 10 : null,
      seriesName: row.series_name,
      seriesOrder: row.series_order,
      publishedAt: row.published_at,
    }));
    
    console.log('Featured books found:', books.length);
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
        SELECT 
          b.id,
          b.title,
          b.cover_image_url,
          b.published_at,
          b.series_id,
          b.series_order,
          u.first_name,
          u.last_name,
          s.name as series_name,
          AVG(r.rating) as avg_rating
        FROM books b
        INNER JOIN users u ON u.id = b.author_id
        LEFT JOIN series s ON s.id = b.series_id
        LEFT JOIN reviews r ON r.application_id IN (
          SELECT a.id FROM applications a WHERE a.book_id = b.id
        )
        INNER JOIN book_genres bg ON bg.book_id = b.id
        INNER JOIN user_genre_preferences ugp ON ugp.genre_id = bg.genre_id AND ugp.user_id = $1
        WHERE b.status = $2
        GROUP BY b.id, u.first_name, u.last_name, s.name
        ORDER BY SUM(ugp.preference_level) DESC, b.published_at DESC NULLS LAST
        ${opts?.take ? `LIMIT ${opts.take}` : ''}
        ${opts?.skip ? `OFFSET ${opts.skip}` : ''}
      `;
      
      const results = await this.dataSource.query(query, [userId, 'active']);
      
      if (results.length === 0) {
        console.log('No personalized recommendations found, falling back to featured books');
        return this.featured();
      }
      
      const books: BookSummaryDto[] = results.map(row => ({
        id: row.id,
        title: row.title,
        authorName: `${row.first_name} ${row.last_name}`,
        coverImageUrl: row.cover_image_url,
        rating: row.avg_rating ? Math.round(row.avg_rating * 10) / 10 : null,
        seriesName: row.series_name,
        seriesOrder: row.series_order,
        publishedAt: row.published_at,
      }));
      
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

  async findOneForAuthor(authorId: string, bookId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({
      where: { id: bookId, authorId },
    });

    if (!book) {
      throw new NotFoundException('Book not found or not owned by author');
    }

    return book;
  }

  async updateFileInfo(
    authorId: string,
    authorUserType: string | undefined,
    bookId: string,
    fileUrl: string,
    fileSize: number,
    fileType: string,
  ): Promise<Book> {
    this.ensureAuthor(authorUserType);

    const book = await this.findOneForAuthor(authorId, bookId);

    book.fileUrl = fileUrl;
    book.fileSize = fileSize.toString();
    book.fileType = fileType;

    return this.bookRepo.save(book);
  }

  async updateCoverImage(
    authorId: string,
    authorUserType: string | undefined,
    bookId: string,
    coverImageUrl: string,
  ) {
    this.ensureAuthor(authorUserType);

    const book = await this.findOneForAuthor(authorId, bookId);

    book.coverImageUrl = coverImageUrl;

    await this.bookRepo.save(book);

    return this.findOnePublic(bookId);
  }

  async checkUserApplicationStatus(userId: string, bookId: string): Promise<boolean> {
    const application = await this.applicationRepo.findOne({
      where: {
        readerId: userId,
        bookId: bookId,
        status: 'approved'
      }
    });

    return !!application;
  }
}


