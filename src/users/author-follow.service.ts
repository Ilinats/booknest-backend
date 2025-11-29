import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AuthorFollow } from './entity/author-follow.entity';
import { User } from './entity/user.entity';
import { Book } from '../books/entity/book.entity';
import { Application } from '../applications/entity/application.entity';

@Injectable()
export class AuthorFollowService {
  constructor(
    @InjectRepository(AuthorFollow)
    private readonly authorFollowRepository: Repository<AuthorFollow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
  ) {}

  async followAuthor(followerId: string, authorId: string): Promise<AuthorFollow> {
    if (followerId === authorId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const author = await this.userRepository.findOne({
      where: { id: authorId, userType: 'author' }
    });

    if (!author) {
      throw new NotFoundException('Author not found');
    }

    const existingFollow = await this.authorFollowRepository.findOne({
      where: { followerId, authorId }
    });

    if (existingFollow) {
      throw new ConflictException('Already following this author');
    }

    const follow = this.authorFollowRepository.create({
      followerId,
      authorId
    });

    return this.authorFollowRepository.save(follow);
  }

  async unfollowAuthor(followerId: string, authorId: string): Promise<void> {
    const follow = await this.authorFollowRepository.findOne({
      where: { followerId, authorId }
    });

    if (!follow) {
      throw new NotFoundException('Not following this author');
    }

    await this.authorFollowRepository.remove(follow);
  }

  async getFollowedAuthors(followerId: string): Promise<AuthorFollow[]> {
    return this.authorFollowRepository.find({
      where: { followerId },
      relations: ['author'],
      order: { createdAt: 'DESC' }
    });
  }

  async getAuthorFollowers(authorId: string): Promise<AuthorFollow[]> {
    return this.authorFollowRepository.find({
      where: { authorId },
      relations: ['follower'],
      order: { createdAt: 'DESC' }
    });
  }

  async isFollowing(followerId: string, authorId: string): Promise<boolean> {
    const follow = await this.authorFollowRepository.findOne({
      where: { followerId, authorId }
    });

    return !!follow;
  }

  async getFollowedAuthorIds(followerId: string): Promise<string[]> {
    const follows = await this.authorFollowRepository.find({
      where: { followerId }
    });

    return follows.map(follow => follow.authorId);
  }

  async getBooksFromFollowedAuthors(followerId: string, limit: number = 20): Promise<Book[]> {
    const followedAuthorIds = await this.getFollowedAuthorIds(followerId);

    if (followedAuthorIds.length === 0) {
      return [];
    }

    const allBooks = await this.bookRepository.find({
      where: {
        authorId: In(followedAuthorIds),
        status: 'active'
      },
      order: { createdAt: 'DESC' },
      take: limit * 2
    });

    const appliedBookIds = await this.applicationRepository
      .createQueryBuilder('application')
      .select('application.bookId')
      .where('application.readerId = :followerId', { followerId })
      .andWhere('application.bookId IN (:...bookIds)', { 
        bookIds: allBooks.map(book => book.id) 
      })
      .getRawMany();

    const appliedBookIdSet = new Set(appliedBookIds.map(item => item.application_bookId));

    const availableBooks = allBooks
      .filter(book => !appliedBookIdSet.has(book.id))
      .slice(0, limit);

    return availableBooks;
  }

  async getFollowedAuthorsWithStats(followerId: string): Promise<Array<{
    author: User;
    follow: AuthorFollow;
    stats: {
      totalBooks: number;
      publishedBooks: number;
      totalApplications: number;
    };
  }>> {
    const follows = await this.getFollowedAuthors(followerId);

    if (follows.length === 0) {
      return [];
    }

    const authorsWithStats = await Promise.all(
      follows.map(async (follow) => {
        const [totalBooks, publishedBooks, totalApplications] = await Promise.all([
          this.bookRepository.count({ where: { authorId: follow.authorId } }),
          this.bookRepository.count({ where: { authorId: follow.authorId, status: 'active' } }),
          this.applicationRepository.count({ 
            where: { book: { authorId: follow.authorId } } 
          })
        ]);

        return {
          author: follow.author!,
          follow,
          stats: {
            totalBooks,
            publishedBooks,
            totalApplications
          }
        };
      })
    );

    return authorsWithStats;
  }
}
