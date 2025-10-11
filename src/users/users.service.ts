import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { User } from './entity/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Book } from '../books/entity/book.entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../applications/entity/review.entity';

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
  ) {}

  async create(createDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: [{ username: createDto.username }, { email: createDto.email }] });
    if (existing) {
      throw new ConflictException({ message: 'User already exists', code: 'USER_EXISTS' });
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

  async findAll(query?: { search?: string; skip?: number; take?: number; isActive?: boolean }): Promise<{ data: User[]; total: number }> {
    const where: FindOptionsWhere<User>[] = [];

    if (query?.search) {
      const s = query.search.trim();
      where.push({ username: ILike(`%${s}%`) });
      where.push({ email: ILike(`%${s}%`) });
      where.push({ firstName: ILike(`%${s}%`) });
      where.push({ lastName: ILike(`%${s}%`) });
    }

    const [data, total] = await this.usersRepository.findAndCount({
      where: where.length ? where : undefined,
      skip: query?.skip ?? 0,
      take: Math.min(query?.take ?? 50, 100),
      order: { createdAt: 'DESC' },
    });

    return { data, total };
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  async update(id: string, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.findOneById(id);

    if (updateDto.username || updateDto.email) {
      const duplicate = await this.usersRepository.findOne({
        where: [
          updateDto.username ? { username: updateDto.username } : undefined,
          updateDto.email ? { email: updateDto.email.toLowerCase() } : undefined,
        ].filter(Boolean) as FindOptionsWhere<User>[],
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({ message: 'User already exists', code: 'USER_EXISTS' });
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
      isActive: typeof updateDto.isActive === 'boolean' ? updateDto.isActive : user.isActive,
    });

    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const res = await this.usersRepository.delete(id);
    if (!res.affected) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
  }

  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stats = await this.getUserStats(userId);

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      stats
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findOneById(userId);

    Object.assign(user, {
      firstName: dto.firstName ?? user.firstName,
      lastName: dto.lastName ?? user.lastName,
      birthDate: dto.birthDate ?? user.birthDate,
      bio: dto.bio ?? user.bio,
      avatarUrl: dto.avatarUrl ?? user.avatarUrl,
    });

    return this.usersRepository.save(user);
  }

  async getUserStats(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userType === 'author') {
      return this.getAuthorStatsData(userId);
    } else {
      return this.getReaderStatsData(userId);
    }
  }

  private async getAuthorStatsData(authorId: string) {
    const [
      totalBooks,
      publishedBooks,
      totalApplications,
      approvedApplications,
      totalReviews,
      averageRating,
      booksWithReviews,
      totalWordCount
    ] = await Promise.all([
      this.bookRepository.count({ where: { authorId } }),
      this.bookRepository.count({ where: { authorId, status: 'active' } }),
      this.applicationRepository.count({ 
        where: { book: { authorId } } 
      }),
      this.applicationRepository.count({ 
        where: { book: { authorId }, status: 'approved' } 
      }),
      this.reviewRepository.count({ 
        where: { 
          application: { book: { authorId } },
          isPublic: true 
        } 
      }),
      this.getAuthorAverageRating(authorId),
      this.getBooksWithReviews(authorId),
      this.getTotalReviewWordCount(authorId)
    ]);

    const pendingApplications = totalApplications - approvedApplications;
    const approvalRate = totalApplications > 0 ? Math.round((approvedApplications / totalApplications) * 100) : 0;

    return {
      totalBooks,
      publishedBooks,
      draftBooks: totalBooks - publishedBooks,
      totalApplications,
      approvedApplications,
      pendingApplications,
      approvalRate,
      totalReviews,
      averageRating,
      booksWithReviews,
      totalWordCount,
      userType: 'author'
    };
  }

  private async getReaderStatsData(readerId: string) {
    const [
      totalApplications,
      approvedApplications,
      completedReads,
      totalReviews,
      averageRating,
      totalWordCount
    ] = await Promise.all([
      this.applicationRepository.count({ where: { readerId } }),
      this.applicationRepository.count({ where: { readerId, status: 'approved' } }),
      this.applicationRepository.count({ where: { readerId, readingStatus: 'reviewed' } }),
      this.reviewRepository.count({ where: { application: { readerId } } }),
      this.getReaderAverageRating(readerId),
      this.getReaderTotalWordCount(readerId)
    ]);

    const pendingApplications = totalApplications - approvedApplications;
    const successRate = totalApplications > 0 ? Math.round((approvedApplications / totalApplications) * 100) : 0;

    return {
      totalApplications,
      approvedApplications,
      pendingApplications,
      successRate,
      completedReads,
      totalReviews,
      averageRating,
      totalWordCount,
      userType: 'reader'
    };
  }

  async getAuthorStats(authorId: string, requestingUserId: string, requestingUserType?: string) {
    const author = await this.usersRepository.findOne({ where: { id: authorId } });
    if (!author) {
      throw new NotFoundException('Author not found');
    }

    if (author.userType !== 'author') {
      throw new ForbiddenException('User is not an author');
    }

    if (authorId !== requestingUserId && requestingUserType !== 'author') {
      throw new ForbiddenException('Access denied to author stats');
    }

    const stats = await this.getAuthorStatsData(authorId);
    
    return {
      author: {
        id: author.id,
        username: author.username,
        firstName: author.firstName,
        lastName: author.lastName,
        bio: author.bio,
        avatarUrl: author.avatarUrl,
        isVerified: author.isVerified,
        createdAt: author.createdAt
      },
      stats
    };
  }

  async getMyStats(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stats = await this.getUserStats(userId);

    return {
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      },
      stats
    };
  }

  private async getAuthorAverageRating(authorId: string): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('AVG(review.rating)', 'average')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
      .getRawOne();

    return result?.average ? parseFloat(parseFloat(result.average).toFixed(1)) : 0;
  }

  private async getBooksWithReviews(authorId: string): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoin('review.application', 'application')
      .leftJoin('application.book', 'book')
      .select('COUNT(DISTINCT application.bookId)', 'count')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
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
      .andWhere('review.isPublic = :isPublic', { isPublic: true })
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

    return result?.average ? parseFloat(parseFloat(result.average).toFixed(1)) : 0;
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
} 