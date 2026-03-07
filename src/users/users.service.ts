import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, MoreThanOrEqual } from 'typeorm';
import { User } from './entity/user.entity';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dto';
import { Book } from '../books/entity';
import { BookStatus } from '../books/enums';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { FilesService } from '../files/files.service';
import { FileErrorCode } from '../files/errors';
import {
  UserResponseDto,
  UserPublicResponseDto,
  UserProfileResponseDto,
} from './dto';
import {
  sanitizeUser,
  sanitizeUserPublic,
  createPaginatedResponse,
} from '../common';
import { UserErrors } from './errors/user-errors';
import { ApplicationStatus } from '../applications/enums';
import { ReadingStatus } from '../applications/enums';
import { UserType } from './enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly filesService: FilesService,
  ) {}

  async create(createDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: [{ username: createDto.username }, { email: createDto.email }],
    });
    if (existing) {
      throw new ConflictException(UserErrors.USER_ALREADY_EXISTS);
    }

    const user = this.usersRepository.create({
      username: createDto.username,
      email: createDto.email.toLowerCase(),
      passwordHash: '',
      firstName: createDto.firstName,
      lastName: createDto.lastName,
      userType: createDto.userType,
      birthDate: createDto.birthDate ?? null,
      bio: createDto.bio ?? null,
      avatarUrl: createDto.avatarUrl ?? null,
      isActive: createDto.isActive ?? true,
    });

    return this.usersRepository.save(user);
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      const error = UserErrors.USER_NOT_FOUND;
      throw new NotFoundException(UserErrors.USER_NOT_FOUND);
    }
    return user;
  }

  async findOneByIdResponse(
    id: string,
    includeEmail: boolean = false,
  ): Promise<UserResponseDto | UserPublicResponseDto> {
    const user = await this.findOneById(id);
    return includeEmail ? sanitizeUser(user) : sanitizeUserPublic(user);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async update(id: string, updateDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.findOneById(id);

    if (updateDto.username || updateDto.email) {
      const duplicate = await this.usersRepository.findOne({
        where: [
          updateDto.username ? { username: updateDto.username } : undefined,
          updateDto.email
            ? { email: updateDto.email.toLowerCase() }
            : undefined,
        ].filter(Boolean) as FindOptionsWhere<User>[],
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(UserErrors.USER_ALREADY_EXISTS);
      }
    }

    Object.assign(user, {
      username: updateDto.username ?? user.username,
      email: updateDto.email ? updateDto.email.toLowerCase() : user.email,
      firstName: updateDto.firstName ?? user.firstName,
      lastName: updateDto.lastName ?? user.lastName,
      birthDate: updateDto.birthDate ?? user.birthDate,
      bio: updateDto.bio ?? user.bio,
      avatarUrl: updateDto.avatarUrl ?? user.avatarUrl,
      isActive:
        typeof updateDto.isActive === 'boolean'
          ? updateDto.isActive
          : user.isActive,
    });

    const updated = await this.usersRepository.save(user);
    return sanitizeUser(updated);
  }

  async remove(id: string): Promise<void> {
    const res = await this.usersRepository.delete(id);
    if (!res.affected) {
      const error = UserErrors.USER_NOT_FOUND;
      throw new NotFoundException(UserErrors.USER_NOT_FOUND);
    }
  }

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      const error = UserErrors.USER_NOT_FOUND;
      throw new NotFoundException(UserErrors.USER_NOT_FOUND);
    }

    const stats = await this.getUserStats(userId);
    const sanitized = sanitizeUserPublic(user);

    return {
      ...sanitized,
      stats,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.findOneById(userId);

    if (dto.username && dto.username !== user.username) {
      const existingUser = await this.usersRepository.findOne({
        where: { username: dto.username },
      });
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException(UserErrors.USER_ALREADY_EXISTS);
      }
    }

    Object.assign(user, {
      username: dto.username ?? user.username,
      firstName: dto.firstName ?? user.firstName,
      lastName: dto.lastName ?? user.lastName,
      birthDate: dto.birthDate ?? user.birthDate,
      bio: dto.bio ?? user.bio,
      avatarUrl:
        dto.avatarUrl !== undefined
          ? dto.avatarUrl === ''
            ? null
            : dto.avatarUrl
          : user.avatarUrl,
    });

    const updated = await this.usersRepository.save(user);
    return sanitizeUser(updated);
  }

  async updateAvatar(
    userId: string,
    avatarUrl: string,
  ): Promise<UserResponseDto> {
    const user = await this.findOneById(userId);
    user.avatarUrl = avatarUrl;
    const updated = await this.usersRepository.save(user);
    return sanitizeUser(updated);
  }

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{
    user: UserResponseDto;
    avatar: {
      url: string;
      size: number;
      type: string;
      originalName: string;
    };
  }> {
    if (!file) {
      throw new BadRequestException(FileErrorCode.FILE_REQUIRED);
    }

    if (!file.buffer) {
      throw new BadRequestException(FileErrorCode.FILE_BUFFER_MISSING);
    }

    const user = await this.findOneById(userId);

    if (user.avatarUrl) {
      await this.filesService.deleteFileByUrl(user.avatarUrl);
    }

    const uploadResult = await this.filesService.uploadImage(file, 'avatars');

    const updatedUser = await this.updateAvatar(userId, uploadResult.fileUrl);

    return {
      user: updatedUser,
      avatar: {
        url: uploadResult.fileUrl,
        size: uploadResult.fileSize,
        type: uploadResult.fileType,
        originalName: file.originalname,
      },
    };
  }

  async removeAvatar(userId: string): Promise<UserResponseDto> {
    const user = await this.findOneById(userId);

    if (user.avatarUrl) {
      await this.filesService.deleteFileByUrl(user.avatarUrl);
    }

    user.avatarUrl = null;
    const updated = await this.usersRepository.save(user);
    return sanitizeUser(updated);
  }

  async getUserStats(userId: string): Promise<Record<string, unknown>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      const error = UserErrors.USER_NOT_FOUND;
      throw new NotFoundException(UserErrors.USER_NOT_FOUND);
    }

    if (user.userType === UserType.AUTHOR) {
      return this.getAuthorStatsData(userId);
    }

    return this.getReaderStatsData(userId);
  }

  private async getAuthorStatsData(
    authorId: string,
  ): Promise<Record<string, unknown>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalBooks,
      publishedBooks,
      totalApplications,
      approvedApplications,
      applicationsThisMonth,
      totalReviews,
      averageRating,
      booksWithReviews,
      totalWordCount,
      averageResponseTime,
    ] = await Promise.all([
      this.bookRepository.count({ where: { authorId } }),
      this.bookRepository.count({
        where: { authorId, status: BookStatus.ACTIVE },
      }),
      this.applicationRepository.count({
        where: { book: { authorId } },
      }),
      this.applicationRepository.count({
        where: { book: { authorId }, status: ApplicationStatus.APPROVED },
      }),
      this.applicationRepository.count({
        where: {
          book: { authorId },
          appliedAt: MoreThanOrEqual(startOfMonth),
        },
      }),
      this.reviewRepository.count({
        where: {
          application: { book: { authorId } },
        },
      }),
      this.getAuthorAverageRating(authorId),
      this.getBooksWithReviews(authorId),
      this.getTotalReviewWordCount(authorId),
      this.getAverageResponseTime(authorId),
    ]);

    const pendingApplications = totalApplications - approvedApplications;
    const approvalRate =
      totalApplications > 0
        ? Math.round((approvedApplications / totalApplications) * 100)
        : 0;

    return {
      totalBooks,
      publishedBooks,
      draftBooks: totalBooks - publishedBooks,
      totalApplications,
      approvedApplications,
      pendingApplications,
      applicationsThisMonth,
      approvalRate,
      averageResponseTime,
      totalReviews,
      averageRating,
      booksWithReviews,
      totalWordCount,
      userType: UserType.AUTHOR,
    };
  }

  private async getReaderStatsData(
    readerId: string,
  ): Promise<Record<string, unknown>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalApplications,
      approvedApplications,
      completedReads,
      completedReadsThisMonth,
      completedReadsThisYear,
      totalReviews,
      averageRating,
      totalWordCount,
      pagesRead,
      genresBreakdown,
      averageReadingTime,
      reviewCompletionRate,
    ] = await Promise.all([
      this.applicationRepository.count({ where: { readerId } }),
      this.applicationRepository.count({
        where: { readerId, status: ApplicationStatus.APPROVED },
      }),
      this.applicationRepository.count({
        where: { readerId, readingStatus: ReadingStatus.REVIEWED },
      }),
      this.applicationRepository.count({
        where: {
          readerId,
          readingStatus: ReadingStatus.REVIEWED,
          readingCompletedAt: MoreThanOrEqual(startOfMonth),
        },
      }),
      this.applicationRepository.count({
        where: {
          readerId,
          readingStatus: ReadingStatus.REVIEWED,
          readingCompletedAt: MoreThanOrEqual(startOfYear),
        },
      }),
      this.reviewRepository.count({ where: { application: { readerId } } }),
      this.getReaderAverageRating(readerId),
      this.getReaderTotalWordCount(readerId),
      this.getReaderPagesRead(readerId),
      this.getReaderGenresBreakdown(readerId),
      this.getReaderAverageReadingTime(readerId),
      this.getReviewCompletionRate(readerId),
    ]);

    const pendingApplications = totalApplications - approvedApplications;
    const successRate =
      totalApplications > 0
        ? Math.round((approvedApplications / totalApplications) * 100)
        : 0;

    return {
      totalApplications,
      approvedApplications,
      pendingApplications,
      successRate,
      completedReads,
      completedReadsThisMonth,
      completedReadsThisYear,
      totalReviews,
      averageRating,
      totalWordCount,
      pagesRead,
      genresBreakdown,
      averageReadingTime,
      reviewCompletionRate,
      userType: UserType.READER,
    };
  }

  async getAuthorStats(
    authorId: string,
    requestingUserId: string,
    requestingUserType?: UserType,
  ): Promise<{
    author: UserPublicResponseDto;
    stats: Record<string, unknown>;
  }> {
    const author = await this.usersRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException(UserErrors.USER_NOT_FOUND);
    }

    if (author.userType !== UserType.AUTHOR) {
      throw new ForbiddenException(UserErrors.USER_NOT_AUTHOR);
    }

    if (
      authorId !== requestingUserId &&
      requestingUserType !== UserType.AUTHOR
    ) {
      throw new ForbiddenException(UserErrors.USER_ACCESS_DENIED);
    }

    const stats = await this.getAuthorStatsData(authorId);
    const authorProfile = sanitizeUserPublic(author);

    return {
      author: authorProfile,
      stats,
    };
  }

  async getMyStats(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(UserErrors.USER_NOT_FOUND);
    }

    const stats = await this.getUserStats(userId);
    const userProfile = sanitizeUser(user);

    return {
      user: userProfile,
      stats,
    };
  }

  private async getAuthorAverageRating(authorId: string): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('AVG(review.rating)', 'average')
      .where('book.authorId = :authorId', { authorId })
      .getRawOne();

    return result?.average
      ? parseFloat(parseFloat(result.average).toFixed(1))
      : 0;
  }

  private async getBooksWithReviews(authorId: string): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('COUNT(DISTINCT application.bookId)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .getRawOne();

    return parseInt(result?.count || '0');
  }

  private async getTotalReviewWordCount(authorId: string): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('SUM(review.wordCount)', 'total')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.wordCount IS NOT NULL')
      .getRawOne();

    return parseInt(result?.total || '0');
  }

  private async getReaderAverageRating(readerId: string): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('AVG(review.rating)', 'average')
      .where('application.readerId = :readerId', { readerId })
      .getRawOne();

    return result?.average
      ? parseFloat(parseFloat(result.average).toFixed(1))
      : 0;
  }

  private async getReaderTotalWordCount(readerId: string): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .select('SUM(review.wordCount)', 'total')
      .where('application.readerId = :readerId', { readerId })
      .andWhere('review.wordCount IS NOT NULL')
      .getRawOne();

    return parseInt(result?.total || '0');
  }

  private async getReaderPagesRead(readerId: string): Promise<number> {
    const result = await this.applicationRepository
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .select('SUM(book.pageCount)', 'total')
      .where('application.readerId = :readerId', { readerId })
      .andWhere('application.readingStatus = :status', {
        status: ReadingStatus.REVIEWED,
      })
      .andWhere('book.pageCount IS NOT NULL')
      .getRawOne();

    return parseInt(result?.total || '0');
  }

  private async getReaderGenresBreakdown(
    readerId: string,
  ): Promise<Array<{ genreId: number; genreName: string; count: number }>> {
    const result = await this.applicationRepository
      .createQueryBuilder('application')
      .leftJoin('application.book', 'book')
      .leftJoin('book.bookGenres', 'bookGenre')
      .leftJoin('bookGenre.genre', 'genre')
      .select('genre.id', 'genreId')
      .addSelect('genre.name', 'genreName')
      .addSelect('COUNT(DISTINCT application.bookId)', 'count')
      .where('application.readerId = :readerId', { readerId })
      .andWhere('application.readingStatus = :status', {
        status: ReadingStatus.REVIEWED,
      })
      .andWhere('genre.id IS NOT NULL')
      .groupBy('genre.id')
      .addGroupBy('genre.name')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map((row) => ({
      genreId: parseInt(row.genreId),
      genreName: row.genreName,
      count: parseInt(row.count),
    }));
  }

  private async getReaderAverageReadingTime(readerId: string): Promise<number> {
    const applications = await this.applicationRepository
      .createQueryBuilder('application')
      .where('application.readerId = :readerId', { readerId })
      .andWhere('application.readingStatus = :status', {
        status: ReadingStatus.REVIEWED,
      })
      .andWhere('application.readingStartedAt IS NOT NULL')
      .andWhere('application.readingCompletedAt IS NOT NULL')
      .getMany();

    if (applications.length === 0) {
      return 0;
    }

    const totalDays = applications.reduce((sum, app) => {
      if (app.readingStartedAt && app.readingCompletedAt) {
        const diffTime =
          app.readingCompletedAt.getTime() - app.readingStartedAt.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return sum + diffDays;
      }
      return sum;
    }, 0);

    return Math.round((totalDays / applications.length) * 10) / 10;
  }

  private async getReviewCompletionRate(readerId: string): Promise<number> {
    const [completedReads, reviews] = await Promise.all([
      this.applicationRepository.count({
        where: {
          readerId,
          readingStatus: ReadingStatus.REVIEWED,
        },
      }),
      this.reviewRepository.count({
        where: { application: { readerId } },
      }),
    ]);

    if (completedReads === 0) {
      return 0;
    }

    return Math.round((reviews / completedReads) * 100);
  }

  private async getAverageResponseTime(authorId: string): Promise<number> {
    const applications = await this.applicationRepository.find({
      where: {
        book: { authorId },
        respondedAt: MoreThanOrEqual(new Date(0)),
      },
      select: ['appliedAt', 'respondedAt'],
    });

    if (applications.length === 0) {
      return 0;
    }

    const totalDays = applications.reduce((sum, app) => {
      if (app.respondedAt && app.appliedAt) {
        const diffTime = app.respondedAt.getTime() - app.appliedAt.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return sum + diffDays;
      }
      return sum;
    }, 0);

    return Math.round(totalDays / applications.length);
  }
}
