import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import { AuthorFollow } from './entity/author-follow.entity';
import { User } from '../users/entity';
import { Book } from '../books/entity';
import { BookStatus } from '../books/enums';
import { Application } from '../applications/entity/application.entity';
import { UserType } from '../users/enums';
import { AuthorFollowErrorCode } from './errors';

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

  async followAuthor(
    followerId: string,
    authorId: string,
  ): Promise<AuthorFollow> {
    if (followerId === authorId) {
      throw new BadRequestException(AuthorFollowErrorCode.CANNOT_FOLLOW_SELF);
    }

    const author = await this.userRepository.findOne({
      where: { id: authorId, userType: UserType.AUTHOR },
    });

    if (!author) {
      throw new NotFoundException(AuthorFollowErrorCode.AUTHOR_NOT_FOUND);
    }

    const existingFollow = await this.authorFollowRepository.findOne({
      where: { followerId, authorId },
    });

    if (existingFollow) {
      throw new ConflictException(AuthorFollowErrorCode.ALREADY_FOLLOWING);
    }

    const follow = this.authorFollowRepository.create({
      followerId,
      authorId,
    });

    return this.authorFollowRepository.save(follow);
  }

  async unfollowAuthor(followerId: string, authorId: string): Promise<void> {
    const follow = await this.authorFollowRepository.findOne({
      where: { followerId, authorId },
    });

    if (!follow) {
      throw new NotFoundException(AuthorFollowErrorCode.NOT_FOLLOWING);
    }

    await this.authorFollowRepository.remove(follow);
  }

  async getFollowedAuthors(followerId: string): Promise<AuthorFollow[]> {
    return this.authorFollowRepository.find({
      where: { followerId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAuthorFollowers(authorId: string): Promise<AuthorFollow[]> {
    return this.authorFollowRepository.find({
      where: { authorId },
      relations: ['follower'],
      order: { createdAt: 'DESC' },
    });
  }

  async isFollowing(followerId: string, authorId: string): Promise<boolean> {
    const follow = await this.authorFollowRepository.findOne({
      where: { followerId, authorId },
    });

    return !!follow;
  }

  async getFollowedAuthorIds(followerId: string): Promise<string[]> {
    const follows = await this.authorFollowRepository.find({
      where: { followerId },
    });

    return follows.map((follow) => follow.authorId);
  }

  async getBooksFromFollowedAuthors(
    followerId: string,
    limit: number = 20,
    userType?: UserType,
  ): Promise<Book[]> {
    const followedAuthorIds = await this.getFollowedAuthorIds(followerId);

    if (followedAuthorIds.length === 0) {
      return [];
    }

    const now = new Date();
    const allBooks = await this.bookRepository.find({
      where: {
        authorId: In(followedAuthorIds),
        status: BookStatus.ACTIVE,
        availableCopies: MoreThan(0),
        applicationDeadline: MoreThan(now),
      },
      relations: ['author'],
      order: { createdAt: 'DESC' },
      take: limit * 2,
    });

    const appliedBookIds = await this.applicationRepository
      .createQueryBuilder('application')
      .select('application.bookId')
      .where('application.readerId = :followerId', { followerId })
      .andWhere('application.bookId IN (:...bookIds)', {
        bookIds: allBooks.map((book) => book.id),
      })
      .getRawMany();

    const appliedBookIdSet = new Set(
      appliedBookIds.map((item) => item.application_bookId),
    );

    const availableBooks = allBooks
      .filter((book) => !appliedBookIdSet.has(book.id))
      .slice(0, limit);

    const sanitizedBooks = availableBooks.map((book) => {
      const isAuthor =
        userType === UserType.AUTHOR && book.authorId === followerId;
      if (!isAuthor) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { fileUrl, fileSize, fileType, ...bookWithoutFiles } = book;
        return bookWithoutFiles as Book;
      }
      return book;
    });

    return sanitizedBooks;
  }
}
