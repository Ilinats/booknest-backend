import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { Genre } from '../genres/entity/genre.entity';
import { User } from '../users/entity/user.entity';
import { UserType } from '../users/enums';
import { Book, BookGenre } from '../books/entity';
import { Series } from '../series/entity/series.entity';
import { Application } from '../applications/entity/application.entity';
import { ApplicationStatus, ReadingStatus } from '../applications/enums';
import { Review } from '../reviews/entity/review.entity';
import { ReviewType } from '../reviews/enums';
import { Friend } from '../friends/entity/friend.entity';
import { AuthorFollow } from '../author-follow/entity/author-follow.entity';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';
import { UserProfile } from '../user-profile/entity/user-profile.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { UserActivity } from '../user-activity/entity/user-activity.entity';
import { FilesService } from '../files/files.service';
import {
  DEMO_ACTIVITIES,
  DEMO_AUTHORS,
  DEMO_AUTHOR_FOLLOWS,
  DEMO_BOOKS,
  DEMO_FRIENDSHIPS,
  DEMO_GENRE_PREFERENCES,
  DEMO_READERS,
  DEMO_SERIES,
  DemoApplicationSeed,
  EPUB_FILENAME,
  daysAgo,
  daysFromNow,
} from './demo-data';
import { SeedAssetsHelper, SharedEpubAsset } from './seed-assets.helper';

@Injectable()
export class SeedingService {
  private readonly logger = new Logger(SeedingService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    @InjectRepository(BookGenre)
    private readonly bookGenreRepository: Repository<BookGenre>,
    @InjectRepository(Series)
    private readonly seriesRepository: Repository<Series>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(AuthorFollow)
    private readonly authorFollowRepository: Repository<AuthorFollow>,
    @InjectRepository(UserGenrePreference)
    private readonly userGenrePrefRepository: Repository<UserGenrePreference>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
    @InjectRepository(UserActivity)
    private readonly userActivityRepository: Repository<UserActivity>,
    @Optional() private readonly filesService?: FilesService,
  ) {}

  async seed() {
    this.logger.log('🌱 Seeding started');

    await this.seedGenres();
    const sharedEpub = await this.uploadSharedEpubIfPossible();

    const authors = await this.seedAuthors();
    const readers = await this.seedReaders();
    const usersByUsername = this.indexUsersByUsername([...authors, ...readers]);

    await this.seedUserProfiles(usersByUsername);
    await this.seedUserAddresses(readers);
    await this.seedUserGenrePreferences(usersByUsername);
    const seriesByName = await this.seedSeries(authors, usersByUsername);
    const booksByTitle = await this.seedBooks(
      usersByUsername,
      seriesByName,
      sharedEpub,
    );
    await this.seedBookGenres(booksByTitle);
    await this.seedApplications(booksByTitle, usersByUsername);
    await this.seedReviews(booksByTitle, usersByUsername);
    await this.seedFriends(usersByUsername);
    await this.seedAuthorFollows(usersByUsername);
    await this.seedUserActivities(usersByUsername, booksByTitle);

    await this.logSeedSummary(booksByTitle);
    this.logger.log('✅ Seeding complete');
  }

  private async logSeedSummary(booksByTitle: Map<string, Book>) {
    const [
      applicationCount,
      reviewCount,
      friendCount,
      followCount,
      activityCount,
    ] = await Promise.all([
      this.applicationRepository.count(),
      this.reviewRepository.count(),
      this.friendRepository.count(),
      this.authorFollowRepository.count(),
      this.userActivityRepository.count(),
    ]);

    this.logger.log('📊 Demo seed summary:');
    this.logger.log(`   Books: ${booksByTitle.size}`);
    this.logger.log(`   Applications: ${applicationCount}`);
    this.logger.log(`   Reviews: ${reviewCount}`);
    this.logger.log(`   Friends: ${friendCount}`);
    this.logger.log(`   Author follows: ${followCount}`);
    this.logger.log(`   User activities: ${activityCount}`);
  }

  private async seedGenres() {
    this.logger.log('📚 Ensuring genres exist...');
    const count = await this.genreRepository.count();
    if (count > 0) {
      this.logger.log(`  ⏭️  ${count} genres already in database`);
      return;
    }

    this.logger.warn(
      '  ⚠️  No genres found — run migrations first (genres are inserted via migration)',
    );
  }

  private async uploadSharedEpubIfPossible(): Promise<SharedEpubAsset | null> {
    if (!this.filesService) {
      this.logger.warn(
        '  ⚠️  FilesService unavailable — books will be seeded without files/covers',
      );
      return null;
    }

    this.logger.log('📤 Uploading shared EPUB to S3...');
    try {
      const asset = await SeedAssetsHelper.uploadSharedEpub(
        this.filesService,
        EPUB_FILENAME,
      );
      this.logger.log(`  ✅ EPUB uploaded (${asset.fileUrl})`);
      return asset;
    } catch (error) {
      this.logger.error(
        `  ❌ EPUB upload failed: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private getSeedUsersPassword(): string {
    const value = this.configService.get<string>('SEED_USERS_PASSWORD');
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new Error(
        'SEED_USERS_PASSWORD must be set in the environment to seed users',
      );
    }
    return trimmed;
  }

  private async seedAuthors(): Promise<User[]> {
    this.logger.log('✍️  Seeding authors...');
    const passwordHash = await argon2.hash(this.getSeedUsersPassword());
    const authors: User[] = [];

    for (const authorData of DEMO_AUTHORS) {
      let author = await this.userRepository.findOne({
        where: { email: authorData.email },
      });
      if (!author) {
        author = this.userRepository.create({
          ...authorData,
          userType: UserType.AUTHOR,
          passwordHash,
          emailVerified: true,
          isVerified: true,
        });
        author = await this.userRepository.save(author);
        this.logger.log(`  ✅ Author: ${authorData.username}`);
      } else {
        this.logger.log(`  ⏭️  Author exists: ${authorData.username}`);
      }
      authors.push(author);
    }

    return authors;
  }

  private async seedReaders(): Promise<User[]> {
    this.logger.log('📖 Seeding readers...');
    const passwordHash = await argon2.hash(this.getSeedUsersPassword());
    const readers: User[] = [];

    for (const readerData of DEMO_READERS) {
      let reader = await this.userRepository.findOne({
        where: { email: readerData.email },
      });
      if (!reader) {
        reader = this.userRepository.create({
          ...readerData,
          userType: UserType.READER,
          passwordHash,
          emailVerified: true,
          isVerified: true,
        });
        reader = await this.userRepository.save(reader);
        this.logger.log(`  ✅ Reader: ${readerData.username}`);
      } else {
        this.logger.log(`  ⏭️  Reader exists: ${readerData.username}`);
      }
      readers.push(reader);
    }

    return readers;
  }

  private indexUsersByUsername(users: User[]): Map<string, User> {
    return new Map(
      users
        .filter((user) => user.username)
        .map((user) => [user.username!, user]),
    );
  }

  private async seedUserProfiles(usersByUsername: Map<string, User>) {
    this.logger.log('👤 Seeding user profiles...');

    for (const user of usersByUsername.values()) {
      const exists = await this.userProfileRepository.findOne({
        where: { userId: user.id },
      });
      if (exists) continue;

      const profile = this.userProfileRepository.create({ userId: user.id });
      await this.userProfileRepository.save(profile);
    }

    this.logger.log('  ✅ User profiles ready');
  }

  private async seedUserAddresses(readers: User[]) {
    this.logger.log('🏠 Seeding reader addresses...');

    const addresses = [
      {
        username: 'alice_reader',
        streetAddress: '12 Vitosha Blvd',
        city: 'Sofia',
        postalCode: '1000',
      },
      {
        username: 'frank_fantasy',
        streetAddress: '8 Graf Ignatiev St',
        city: 'Sofia',
        postalCode: '1000',
      },
      {
        username: 'ivy_bookstagram',
        streetAddress: '45 Shipka St',
        city: 'Sofia',
        postalCode: '1504',
      },
      {
        username: 'diana_loves_books',
        streetAddress: '3 Han Krum St',
        city: 'Plovdiv',
        postalCode: '4000',
      },
    ];

    for (const addressData of addresses) {
      const reader = readers.find((r) => r.username === addressData.username);
      if (!reader) continue;

      const exists = await this.userAddressRepository.findOne({
        where: { userId: reader.id, isPrimary: true },
      });
      if (exists) continue;

      const address = this.userAddressRepository.create({
        userId: reader.id,
        streetAddress: addressData.streetAddress,
        city: addressData.city,
        postalCode: addressData.postalCode,
        country: 'Bulgaria',
        isPrimary: true,
      });
      await this.userAddressRepository.save(address);
    }

    this.logger.log('  ✅ Reader addresses seeded');
  }

  private async seedUserGenrePreferences(usersByUsername: Map<string, User>) {
    this.logger.log('🎯 Seeding genre preferences...');
    const genres = await this.genreRepository.find();

    for (const pref of DEMO_GENRE_PREFERENCES) {
      const user = usersByUsername.get(pref.username);
      if (!user) continue;

      for (const genreName of pref.genres) {
        const genre = genres.find((g) => g.name === genreName);
        if (!genre) continue;

        const exists = await this.userGenrePrefRepository.findOne({
          where: { user: { id: user.id }, genre: { id: genre.id } },
        });
        if (exists) continue;

        await this.userGenrePrefRepository.save(
          this.userGenrePrefRepository.create({ user, genre }),
        );
      }
    }

    this.logger.log('  ✅ Genre preferences seeded');
  }

  private async seedSeries(
    authors: User[],
    usersByUsername: Map<string, User>,
  ): Promise<Map<string, Series>> {
    this.logger.log('📚 Seeding series...');
    const seriesByName = new Map<string, Series>();

    for (const seriesInfo of DEMO_SERIES) {
      const author = usersByUsername.get(seriesInfo.authorUsername);
      if (!author) continue;

      let seriesItem = await this.seriesRepository.findOne({
        where: { authorId: author.id, name: seriesInfo.name },
      });
      if (!seriesItem) {
        seriesItem = await this.seriesRepository.save(
          this.seriesRepository.create({
            authorId: author.id,
            name: seriesInfo.name,
            description: seriesInfo.description,
          }),
        );
        this.logger.log(`  ✅ Series: ${seriesInfo.name}`);
      }
      seriesByName.set(seriesInfo.name, seriesItem);
    }

    return seriesByName;
  }

  private async seedBooks(
    usersByUsername: Map<string, User>,
    seriesByName: Map<string, Series>,
    sharedEpub: SharedEpubAsset | null,
  ): Promise<Map<string, Book>> {
    this.logger.log('📕 Seeding books...');
    const booksByTitle = new Map<string, Book>();

    for (const bookData of DEMO_BOOKS) {
      const author = usersByUsername.get(bookData.authorUsername);
      if (!author) {
        this.logger.warn(`  ⚠️  Author not found for ${bookData.title}`);
        continue;
      }

      let book = await this.bookRepository.findOne({
        where: { authorId: author.id, title: bookData.title },
      });

      let coverImageUrl = book?.coverImageUrl ?? null;
      if (!coverImageUrl && this.filesService) {
        try {
          coverImageUrl = await SeedAssetsHelper.uploadCover(
            this.filesService,
            bookData.coverFile,
          );
        } catch (error) {
          this.logger.warn(
            `  ⚠️  Cover upload failed for ${bookData.title}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      const needsFile = SeedAssetsHelper.needsDigitalFile(
        bookData.distributionType,
      );
      const fileFields =
        needsFile && sharedEpub
          ? {
              fileUrl: sharedEpub.fileUrl,
              fileSize: String(sharedEpub.fileSize),
              fileType: sharedEpub.fileType,
            }
          : {};

      const payload = {
        authorId: author.id,
        title: bookData.title,
        shortDescription: bookData.shortDescription,
        fullDescription: bookData.fullDescription,
        ageRating: bookData.ageRating,
        distributionType: bookData.distributionType,
        totalCopies: bookData.totalCopies,
        availableCopies: bookData.totalCopies - bookData.approvedCount,
        applicationDeadline: daysFromNow(
          bookData.applicationDeadlineDaysFromNow,
        ),
        reviewDeadline:
          bookData.reviewDeadlineDaysFromNow !== undefined
            ? daysFromNow(bookData.reviewDeadlineDaysFromNow)
            : null,
        selectionMethod: bookData.selectionMethod,
        selectionCriteria: bookData.selectionCriteria,
        status: bookData.status,
        pageCount: bookData.pageCount,
        seriesId: bookData.seriesName
          ? seriesByName.get(bookData.seriesName)?.id
          : undefined,
        seriesOrder: bookData.seriesOrder,
        publishedAt: bookData.publishedDaysAgo
          ? daysAgo(bookData.publishedDaysAgo)
          : null,
        lotteryRunAt: bookData.lotteryRunDaysAgo
          ? daysAgo(bookData.lotteryRunDaysAgo)
          : null,
        coverImageUrl,
        ...fileFields,
      };

      if (!book) {
        book = await this.bookRepository.save(
          this.bookRepository.create(payload),
        );
        this.logger.log(`  ✅ Book: ${bookData.title}`);
      } else {
        Object.assign(book, payload);
        book = await this.bookRepository.save(book);
        this.logger.log(`  ⏭️  Updated book: ${bookData.title}`);
      }

      booksByTitle.set(bookData.title, book);
    }

    return booksByTitle;
  }

  private async seedBookGenres(booksByTitle: Map<string, Book>) {
    this.logger.log('🏷️  Seeding book genres...');
    const genres = await this.genreRepository.find();

    for (const bookData of DEMO_BOOKS) {
      const book = booksByTitle.get(bookData.title);
      if (!book) continue;

      for (const genreName of bookData.genres) {
        const genre = genres.find((g) => g.name === genreName);
        if (!genre) continue;

        const exists = await this.bookGenreRepository.findOne({
          where: { bookId: book.id, genreId: genre.id },
        });
        if (exists) continue;

        await this.bookGenreRepository.save(
          this.bookGenreRepository.create({
            bookId: book.id,
            genreId: genre.id,
          }),
        );
      }
    }

    this.logger.log('  ✅ Book genres seeded');
  }

  private async seedApplications(
    booksByTitle: Map<string, Book>,
    usersByUsername: Map<string, User>,
  ): Promise<Application[]> {
    this.logger.log('📝 Seeding applications...');
    const applications: Application[] = [];

    for (const bookData of DEMO_BOOKS) {
      const book = booksByTitle.get(bookData.title);
      const author = usersByUsername.get(bookData.authorUsername);
      if (!book || !author) continue;

      for (const appData of bookData.applications) {
        const reader = usersByUsername.get(appData.readerUsername);
        if (!reader) continue;

        const application = await this.createApplication(
          book,
          author.id,
          reader.id,
          appData,
        );
        if (application) applications.push(application);
      }
    }

    this.logger.log(`  ✅ ${applications.length} applications seeded`);
    return applications;
  }

  private async createApplication(
    book: Book,
    authorId: string,
    readerId: string,
    data: DemoApplicationSeed,
  ): Promise<Application | null> {
    const exists = await this.applicationRepository.findOne({
      where: { bookId: book.id, readerId },
    });
    if (exists) return null;

    const isApproved = data.status === ApplicationStatus.APPROVED;
    const isDigital = SeedAssetsHelper.needsDigitalFile(book.distributionType);
    const respondedAt = data.daysAgoResponded
      ? daysAgo(data.daysAgoResponded)
      : undefined;
    const copySentAt =
      isApproved && isDigital
        ? data.daysAgoCopySent
          ? daysAgo(data.daysAgoCopySent)
          : respondedAt
        : isApproved && !isDigital && data.daysAgoCopySent
          ? daysAgo(data.daysAgoCopySent)
          : undefined;

    const application = this.applicationRepository.create({
      bookId: book.id,
      readerId,
      status: data.status,
      applicationMessage: data.message,
      readingStatus: data.readingStatus ?? ReadingStatus.NOT_STARTED,
      respondedAt,
      respondedById:
        data.status === ApplicationStatus.APPROVED ||
        data.status === ApplicationStatus.REJECTED
          ? authorId
          : undefined,
      authorNotes: data.authorNotes,
      copySentAt,
      copyReceivedAt: data.daysAgoCopyReceived
        ? daysAgo(data.daysAgoCopyReceived)
        : undefined,
      readingStartedAt: data.daysAgoReadingStarted
        ? daysAgo(data.daysAgoReadingStarted)
        : undefined,
      readingCompletedAt: data.daysAgoReadingCompleted
        ? daysAgo(data.daysAgoReadingCompleted)
        : undefined,
      reviewSubmittedAt: data.daysAgoReviewSubmitted
        ? daysAgo(data.daysAgoReviewSubmitted)
        : undefined,
    });

    return this.applicationRepository.save(application);
  }

  private async seedReviews(
    booksByTitle: Map<string, Book>,
    usersByUsername: Map<string, User>,
  ) {
    this.logger.log('⭐ Seeding reviews...');

    let reviewCount = 0;
    for (const bookData of DEMO_BOOKS) {
      const book = booksByTitle.get(bookData.title);
      if (!book) continue;

      for (const appData of bookData.applications) {
        if (!appData.review) continue;

        const reader = usersByUsername.get(appData.readerUsername);
        if (!reader) continue;

        const application = await this.applicationRepository.findOne({
          where: { bookId: book.id, readerId: reader.id },
        });
        if (!application) continue;

        const exists = await this.reviewRepository.findOne({
          where: { applicationId: application.id },
        });
        if (exists) continue;

        const reviewType = appData.review.reviewType ?? ReviewType.TEXT;
        const reviewContent = appData.review.reviewContent ?? null;
        const reviewUrls = appData.review.reviewUrls ?? null;
        const wordCount =
          reviewType === ReviewType.TEXT && reviewContent
            ? reviewContent.trim().split(/\s+/).filter(Boolean).length
            : null;

        await this.reviewRepository.save(
          this.reviewRepository.create({
            applicationId: application.id,
            rating: appData.review.rating,
            reviewType,
            reviewContent,
            reviewUrls,
            wordCount,
            isPublic: appData.review.isPublic ?? true,
          }),
        );
        reviewCount++;
      }
    }

    this.logger.log(`  ✅ ${reviewCount} reviews seeded`);
  }

  private async seedFriends(usersByUsername: Map<string, User>) {
    this.logger.log('👫 Seeding friends...');

    for (const friendData of DEMO_FRIENDSHIPS) {
      const requester = usersByUsername.get(friendData.requesterUsername);
      const addressee = usersByUsername.get(friendData.addresseeUsername);
      if (!requester || !addressee) continue;

      const exists = await this.friendRepository.findOne({
        where: [
          { requesterId: requester.id, addresseeId: addressee.id },
          { requesterId: addressee.id, addresseeId: requester.id },
        ],
      });
      if (exists) continue;

      await this.friendRepository.save(
        this.friendRepository.create({
          requesterId: requester.id,
          addresseeId: addressee.id,
          status: friendData.status,
        }),
      );
    }

    this.logger.log('  ✅ Friends seeded');
  }

  private async seedAuthorFollows(usersByUsername: Map<string, User>) {
    this.logger.log('🔔 Seeding author follows...');

    for (const followData of DEMO_AUTHOR_FOLLOWS) {
      const follower = usersByUsername.get(followData.followerUsername);
      const author = usersByUsername.get(followData.authorUsername);
      if (!follower || !author) continue;

      const exists = await this.authorFollowRepository.findOne({
        where: { followerId: follower.id, authorId: author.id },
      });
      if (exists) continue;

      await this.authorFollowRepository.save(
        this.authorFollowRepository.create({
          followerId: follower.id,
          authorId: author.id,
        }),
      );
    }

    this.logger.log('  ✅ Author follows seeded');
  }

  private async seedUserActivities(
    usersByUsername: Map<string, User>,
    booksByTitle: Map<string, Book>,
  ) {
    this.logger.log('📣 Seeding user activities...');

    for (const activityData of DEMO_ACTIVITIES) {
      const user = usersByUsername.get(activityData.username);
      if (!user) continue;

      const book = activityData.bookTitle
        ? booksByTitle.get(activityData.bookTitle)
        : undefined;

      const exists = await this.userActivityRepository.findOne({
        where: {
          userId: user.id,
          activityType: activityData.activityType,
          bookId: book?.id,
        },
      });
      if (exists) continue;

      await this.userActivityRepository.save(
        this.userActivityRepository.create({
          userId: user.id,
          activityType: activityData.activityType,
          bookId: book?.id,
        }),
      );
    }

    this.logger.log('  ✅ User activities seeded');
  }
}
