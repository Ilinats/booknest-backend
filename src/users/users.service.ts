import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { User } from './entity/user.entity';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dto';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { FilesService } from '../files/files.service';
import { FileErrorCode } from '../files/errors';
import {
  UserResponseDto,
  UserPublicResponseDto,
  UserProfileResponseDto,
} from './dto';
import { sanitizeUser, sanitizeUserPublic } from '../common';
import { UserErrors } from './errors/user-errors';
import { UserType } from './enums';
import { BooksAnalyticsAuthorQueriesHelper } from '../books/helpers/books-analytics-author-queries.helper';
import { UsersReaderStatsHelper } from './helpers/users-reader-stats.helper';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly filesService: FilesService,
    @Inject(forwardRef(() => BooksAnalyticsAuthorQueriesHelper))
    private readonly authorStatsQueries: BooksAnalyticsAuthorQueriesHelper,
    private readonly readerStatsHelper: UsersReaderStatsHelper,
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
      throw new NotFoundException(UserErrors.USER_NOT_FOUND);
    }
  }

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.findOneById(userId);
    const stats = await this.getUserStatsForUser(user);

    return {
      ...sanitizeUserPublic(user),
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
    user.avatarUrl = uploadResult.fileUrl;
    const updated = await this.usersRepository.save(user);

    return {
      user: sanitizeUser(updated),
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
    const user = await this.findOneById(userId);
    return this.getUserStatsForUser(user);
  }

  async getAuthorStats(
    authorId: string,
    requestingUserId: string,
    requestingUserType?: UserType,
  ): Promise<{
    author: UserPublicResponseDto;
    stats: Record<string, unknown>;
  }> {
    const author = await this.findOneById(authorId);

    if (author.userType !== UserType.AUTHOR) {
      throw new ForbiddenException(UserErrors.USER_NOT_AUTHOR);
    }

    if (
      authorId !== requestingUserId &&
      requestingUserType !== UserType.AUTHOR
    ) {
      throw new ForbiddenException(UserErrors.USER_ACCESS_DENIED);
    }

    return {
      author: sanitizeUserPublic(author),
      stats: await this.getAuthorStatsData(authorId),
    };
  }

  async getMyStats(userId: string) {
    const user = await this.findOneById(userId);
    const stats = await this.getUserStatsForUser(user);

    return {
      user: sanitizeUser(user),
      stats,
    };
  }

  private getUserStatsForUser(user: User): Promise<Record<string, unknown>> {
    if (user.userType === UserType.AUTHOR) {
      return this.getAuthorStatsData(user.id);
    }

    return this.readerStatsHelper.getStats(user.id);
  }

  private async getAuthorStatsData(
    authorId: string,
  ): Promise<Record<string, unknown>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      bookCounts,
      applicationCounts,
      totalReviews,
      averageRating,
      booksWithReviews,
      totalWordCount,
      averageResponseTime,
    ] = await Promise.all([
      this.authorStatsQueries.getBookStatusCounts(authorId),
      this.authorStatsQueries.getApplicationOverview(
        authorId,
        null,
        startOfMonth,
      ),
      this.reviewRepository.count({
        where: { application: { book: { authorId } } },
      }),
      this.authorStatsQueries.getAuthorAverageRating(authorId, null),
      this.authorStatsQueries.getBooksWithReviews(authorId),
      this.getTotalReviewWordCount(authorId),
      this.authorStatsQueries.getAuthorAverageResponseTime(authorId),
    ]);

    return {
      totalBooks: bookCounts.total,
      publishedBooks: bookCounts.published,
      draftBooks: bookCounts.draft,
      inProgressBooks: bookCounts.inProgress,
      completedBooks: bookCounts.completed,
      totalApplications: applicationCounts.total,
      approvedApplications: applicationCounts.approved,
      pendingApplications: applicationCounts.pending,
      applicationsThisMonth: applicationCounts.thisMonth,
      approvalRate: percent(
        applicationCounts.approved,
        applicationCounts.total,
      ),
      averageResponseTime,
      totalReviews,
      averageRating,
      booksWithReviews,
      totalWordCount,
      userType: UserType.AUTHOR,
    };
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

    return parseInt(result?.total || '0', 10);
  }
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
