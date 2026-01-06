import { Injectable, Logger } from '@nestjs/common';
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
import { Friend } from '../friends/entity/friend.entity';
import { FriendStatus } from '../friends/enums';
import { UserGenrePreference } from '../user-genre-preferences/entity/user-genre-preference.entity';
import {
  AgeRating,
  DistributionType,
  BookStatus,
  SelectionMethod,
} from '../books/enums';
import { ReviewType } from '../reviews/enums';

@Injectable()
export class SeedingService {
  private readonly logger = new Logger(SeedingService.name);

  constructor(
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
    @InjectRepository(UserGenrePreference)
    private readonly userGenrePrefRepository: Repository<UserGenrePreference>,
  ) {}

  async seed() {
    this.logger.log('🌱 Seeding started');

    await this.seedGenres();

    const { authors, readers } = await this.seedUsers();

    await this.seedUserGenrePreferences(authors, readers);

    const series = await this.seedSeries(authors);

    const books = await this.seedBooks(authors, series);
    await this.seedBookGenres(books);

    const applications = await this.seedApplications(books, readers);
    await this.seedReviews(applications);

    await this.seedFriends(readers);

    this.logger.log('✅ Seeding complete');
  }

  private async seedGenres() {
    this.logger.log('📚 Seeding genres...');
    const genres = [
      'Art',
      'Biography',
      'Business',
      'Chick Lit',
      "Children's",
      'Christian',
      'Classics',
      'Comics',
      'Contemporary',
      'Cookbooks',
      'Crime',
      'Ebooks',
      'Fantasy',
      'High Fantasy',
      'Low Fantasy',
      'Urban Fantasy',
      'Dystopian',
      'Fiction',
      'Graphic Novels',
      'Historical Fiction',
      'History',
      'Horror',
      'Humor and Comedy',
      'Manga',
      'Memoir',
      'Music',
      'Mystery',
      'Nonfiction',
      'Paranormal',
      'Philosophy',
      'Poetry',
      'Psychology',
      'Religion',
      'Romance',
      'Romantic Comedy',
      'Romantasy',
      'Science',
      'Science Fiction',
      'Self Help',
      'Suspense',
      'Spirituality',
      'Sports',
      'Thriller',
      'Travel',
      'Young Adult',
    ];

    for (const name of genres) {
      const exists = await this.genreRepository.findOne({ where: { name } });
      if (exists) {
        this.logger.log(`  ⏭️  Genre already exists: ${name}`);
        continue;
      }
      const genre = this.genreRepository.create({ name });
      await this.genreRepository.save(genre);
      this.logger.log(`  ✅ Seeded genre: ${name}`);
    }
  }

  private async seedUsers() {
    this.logger.log('👥 Seeding users...');
    const passwordHash = await argon2.hash('password123'); 

    const authorsData = [
      {
        username: 'sarah_author',
        email: 'sarah.author@example.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        userType: UserType.AUTHOR,
        bio: 'Award-winning fantasy author with 10+ years of experience.',
        emailVerified: true,
        isVerified: true,
      },
      {
        username: 'michael_writer',
        email: 'michael.writer@example.com',
        firstName: 'Michael',
        lastName: 'Chen',
        userType: UserType.AUTHOR,
        bio: 'Science fiction and thriller novelist.',
        emailVerified: true,
        isVerified: true,
      },
      {
        username: 'emma_novels',
        email: 'emma.novels@example.com',
        firstName: 'Emma',
        lastName: 'Williams',
        userType: UserType.AUTHOR,
        bio: 'Romance and historical fiction writer.',
        emailVerified: true,
        isVerified: true,
      },
    ];

    const authors: User[] = [];
    for (const authorData of authorsData) {
      let author = await this.userRepository.findOne({
        where: { email: authorData.email },
      });
      if (!author) {
        author = this.userRepository.create({
          ...authorData,
          passwordHash,
        });
        author = await this.userRepository.save(author);
        this.logger.log(`  ✅ Seeded author: ${authorData.username}`);
      } else {
        this.logger.log(`  ⏭️  Author already exists: ${authorData.username}`);
      }
      authors.push(author);
    }

    const readersData = [
      {
        username: 'alice_reader',
        email: 'alice.reader@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        userType: UserType.READER,
        bio: 'Avid reader of fantasy and mystery novels.',
        emailVerified: true,
        isVerified: true,
      },
      {
        username: 'bob_bookworm',
        email: 'bob.bookworm@example.com',
        firstName: 'Bob',
        lastName: 'Martinez',
        userType: UserType.READER,
        bio: 'Love science fiction and thrillers.',
        emailVerified: true,
        isVerified: true,
      },
      {
        username: 'charlie_reads',
        email: 'charlie.reads@example.com',
        firstName: 'Charlie',
        lastName: 'Brown',
        userType: UserType.READER,
        bio: 'Enthusiastic reader of all genres.',
        emailVerified: true,
        isVerified: true,
      },
      {
        username: 'diana_loves_books',
        email: 'diana.books@example.com',
        firstName: 'Diana',
        lastName: 'Davis',
        userType: UserType.READER,
        bio: 'Romance and historical fiction enthusiast.',
        emailVerified: true,
        isVerified: true,
      },
      {
        username: 'eve_reviews',
        email: 'eve.reviews@example.com',
        firstName: 'Eve',
        lastName: 'Wilson',
        userType: UserType.READER,
        bio: 'Book reviewer and blogger.',
        emailVerified: true,
        isVerified: true,
      },
    ];

    const readers: User[] = [];
    for (const readerData of readersData) {
      let reader = await this.userRepository.findOne({
        where: { email: readerData.email },
      });
      if (!reader) {
        reader = this.userRepository.create({
          ...readerData,
          passwordHash,
        });
        reader = await this.userRepository.save(reader);
        this.logger.log(`  ✅ Seeded reader: ${readerData.username}`);
      } else {
        this.logger.log(`  ⏭️  Reader already exists: ${readerData.username}`);
      }
      readers.push(reader);
    }

    return { authors, readers };
  }

  private async seedUserGenrePreferences(authors: User[], readers: User[]) {
    this.logger.log('🎯 Seeding user genre preferences...');
    const genres = await this.genreRepository.find();

    const authorPreferences = [
      { author: authors[0], genres: ['Fantasy', 'Adventure'] },
      { author: authors[1], genres: ['Science Fiction', 'Thriller'] },
      { author: authors[2], genres: ['Romance', 'Historical'] },
    ];

    for (const pref of authorPreferences) {
      for (const genreName of pref.genres) {
        const genre = genres.find((g) => g.name === genreName);
        if (genre) {
          const exists = await this.userGenrePrefRepository.findOne({
            where: { user: { id: pref.author.id }, genre: { id: genre.id } },
          });
          if (!exists) {
            const userPref = this.userGenrePrefRepository.create({
              user: pref.author,
              genre,
            });
            await this.userGenrePrefRepository.save(userPref);
          }
        }
      }
    }

    const readerPreferences = [
      { reader: readers[0], genres: ['Fantasy', 'Mystery', 'Adventure'] },
      { reader: readers[1], genres: ['Science Fiction', 'Thriller'] },
      { reader: readers[2], genres: ['Fantasy', 'Science Fiction', 'Romance'] },
      { reader: readers[3], genres: ['Romance', 'Historical'] },
      { reader: readers[4], genres: ['Non-Fiction', 'Biography', 'Self-Help'] },
    ];

    for (const pref of readerPreferences) {
      for (const genreName of pref.genres) {
        const genre = genres.find((g) => g.name === genreName);
        if (genre) {
          const exists = await this.userGenrePrefRepository.findOne({
            where: { user: { id: pref.reader.id }, genre: { id: genre.id } },
          });
          if (!exists) {
            const userPref = this.userGenrePrefRepository.create({
              user: pref.reader,
              genre,
            });
            await this.userGenrePrefRepository.save(userPref);
          }
        }
      }
    }

    this.logger.log('  ✅ User genre preferences seeded');
  }

  private async seedSeries(authors: User[]) {
    this.logger.log('📖 Seeding series...');
    const seriesData = [
      {
        authorId: authors[0].id,
        name: 'The Chronicles of Eldoria',
        description:
          'An epic fantasy series following the adventures of heroes in a magical realm.',
      },
      {
        authorId: authors[1].id,
        name: 'Quantum Shadows',
        description:
          'A science fiction thriller series exploring the boundaries of technology and humanity.',
      },
    ];

    const series: Series[] = [];
    for (const seriesInfo of seriesData) {
      let seriesItem = await this.seriesRepository.findOne({
        where: { authorId: seriesInfo.authorId, name: seriesInfo.name },
      });
      if (!seriesItem) {
        seriesItem = this.seriesRepository.create(seriesInfo);
        seriesItem = await this.seriesRepository.save(seriesItem);
        this.logger.log(`  ✅ Seeded series: ${seriesInfo.name}`);
      } else {
        this.logger.log(`  ⏭️  Series already exists: ${seriesInfo.name}`);
      }
      series.push(seriesItem);
    }

    return series;
  }

  private async seedBooks(authors: User[], series: Series[]) {
    this.logger.log('📚 Seeding books...');
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); 
    const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); 

    const booksData = [
      
      {
        authorId: authors[0].id,
        title: 'The Enchanted Forest',
        shortDescription:
          'A young mage discovers a hidden world within an ancient forest.',
        fullDescription:
          'In this captivating fantasy novel, follow the journey of a young mage who stumbles upon a magical realm hidden within an ancient forest. As they explore this mysterious world, they uncover secrets that will change everything.',
        ageRating: AgeRating.ALL,
        distributionType: DistributionType.BOTH,
        totalCopies: 5,
        availableCopies: 2,
        applicationDeadline: futureDate,
        reviewDeadline: new Date(
          futureDate.getTime() + 60 * 24 * 60 * 60 * 1000,
        ),
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        status: BookStatus.ACTIVE,
        seriesId: series[0]?.id,
        seriesOrder: 1,
        pageCount: 350,
      },
      {
        authorId: authors[0].id,
        title: "Dragon's Legacy",
        shortDescription:
          'The second book in the Chronicles of Eldoria series.',
        fullDescription:
          'Continuing the epic saga, this book follows the heroes as they face ancient dragons and uncover the legacy of their ancestors.',
        ageRating: AgeRating.THIRTEEN_PLUS,
        distributionType: DistributionType.PHYSICAL,
        totalCopies: 3,
        availableCopies: 0,
        applicationDeadline: pastDate,
        reviewDeadline: new Date(pastDate.getTime() + 60 * 24 * 60 * 60 * 1000),
        selectionMethod: SelectionMethod.LOTTERY,
        status: BookStatus.COMPLETED,
        seriesId: series[0]?.id,
        seriesOrder: 2,
        pageCount: 420,
      },
      {
        authorId: authors[0].id,
        title: 'Mystic Realms',
        shortDescription: 'A standalone fantasy adventure.',
        fullDescription:
          'A standalone novel about a warrior who must navigate through mystical realms to save their kingdom.',
        ageRating: AgeRating.ALL,
        distributionType: DistributionType.DIGITAL,
        totalCopies: 10,
        availableCopies: 7,
        applicationDeadline: futureDate,
        reviewDeadline: new Date(
          futureDate.getTime() + 45 * 24 * 60 * 60 * 1000,
        ),
        selectionMethod: SelectionMethod.FIRST_COME,
        status: BookStatus.ACTIVE,
        pageCount: 280,
      },
      
      {
        authorId: authors[1].id,
        title: 'Neural Networks',
        shortDescription: 'A thriller about AI consciousness.',
        fullDescription:
          'In a near-future world, a scientist discovers that AI has achieved consciousness, leading to a race against time to prevent a global catastrophe.',
        ageRating: AgeRating.SIXTEEN_PLUS,
        distributionType: DistributionType.BOTH,
        totalCopies: 4,
        availableCopies: 1,
        applicationDeadline: futureDate,
        reviewDeadline: new Date(
          futureDate.getTime() + 50 * 24 * 60 * 60 * 1000,
        ),
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        status: BookStatus.ACTIVE,
        seriesId: series[1]?.id,
        seriesOrder: 1,
        pageCount: 380,
      },
      {
        authorId: authors[1].id,
        title: 'Digital Shadows',
        shortDescription: 'The sequel to Neural Networks.',
        fullDescription:
          'The AI crisis deepens as the protagonists must navigate a world where reality and virtuality blur.',
        ageRating: AgeRating.SIXTEEN_PLUS,
        distributionType: DistributionType.DIGITAL,
        totalCopies: 6,
        availableCopies: 3,
        applicationDeadline: futureDate,
        reviewDeadline: new Date(
          futureDate.getTime() + 55 * 24 * 60 * 60 * 1000,
        ),
        selectionMethod: SelectionMethod.LOTTERY,
        status: BookStatus.ACTIVE,
        seriesId: series[1]?.id,
        seriesOrder: 2,
        pageCount: 400,
      },
      {
        authorId: authors[1].id,
        title: 'The Last Protocol',
        shortDescription: 'A standalone techno-thriller.',
        fullDescription:
          'A cybersecurity expert uncovers a global conspiracy involving a secret protocol that could end civilization.',
        ageRating: AgeRating.EIGHTEEN_PLUS,
        distributionType: DistributionType.PHYSICAL,
        totalCopies: 2,
        availableCopies: 0,
        applicationDeadline: pastDate,
        reviewDeadline: new Date(pastDate.getTime() + 40 * 24 * 60 * 60 * 1000),
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        status: BookStatus.IN_PROGRESS,
        pageCount: 320,
      },
      
      {
        authorId: authors[2].id,
        title: 'Victorian Hearts',
        shortDescription: 'A romance set in Victorian England.',
        fullDescription:
          'A sweeping romance novel set in Victorian England, following the forbidden love between a lady and a commoner.',
        ageRating: AgeRating.ALL,
        distributionType: DistributionType.BOTH,
        totalCopies: 8,
        availableCopies: 5,
        applicationDeadline: futureDate,
        reviewDeadline: new Date(
          futureDate.getTime() + 70 * 24 * 60 * 60 * 1000,
        ),
        selectionMethod: SelectionMethod.FIRST_COME,
        status: BookStatus.ACTIVE,
        pageCount: 450,
      },
      {
        authorId: authors[2].id,
        title: 'Draft Novel',
        shortDescription: 'A work in progress.',
        fullDescription:
          'This is a draft novel that has not been published yet.',
        ageRating: AgeRating.ALL,
        distributionType: DistributionType.DIGITAL,
        totalCopies: 1,
        availableCopies: 1,
        applicationDeadline: futureDate,
        reviewDeadline: null,
        selectionMethod: SelectionMethod.AUTHOR_SELECTS,
        status: BookStatus.DRAFT,
        pageCount: 200,
      },
    ];

    const books: Book[] = [];
    for (const bookData of booksData) {
      let book = await this.bookRepository.findOne({
        where: { authorId: bookData.authorId, title: bookData.title },
      });
      if (!book) {
        book = this.bookRepository.create(bookData);
        book = await this.bookRepository.save(book);
        this.logger.log(`  ✅ Seeded book: ${bookData.title}`);
      } else {
        this.logger.log(`  ⏭️  Book already exists: ${bookData.title}`);
      }
      books.push(book);
    }

    return books;
  }

  private async seedBookGenres(books: Book[]) {
    this.logger.log('🏷️  Seeding book genres...');
    const genres = await this.genreRepository.find();

    const bookGenreMappings = [
      { bookTitle: 'The Enchanted Forest', genres: ['Fantasy', 'Adventure'] },
      { bookTitle: "Dragon's Legacy", genres: ['Fantasy', 'Adventure'] },
      { bookTitle: 'Mystic Realms', genres: ['Fantasy'] },
      { bookTitle: 'Neural Networks', genres: ['Science Fiction', 'Thriller'] },
      { bookTitle: 'Digital Shadows', genres: ['Science Fiction', 'Thriller'] },
      {
        bookTitle: 'The Last Protocol',
        genres: ['Thriller', 'Science Fiction'],
      },
      { bookTitle: 'Victorian Hearts', genres: ['Romance', 'Historical'] },
      { bookTitle: 'Draft Novel', genres: ['Romance'] },
    ];

    for (const mapping of bookGenreMappings) {
      const book = books.find((b) => b.title === mapping.bookTitle);
      if (!book) continue;

      for (const genreName of mapping.genres) {
        const genre = genres.find((g) => g.name === genreName);
        if (genre) {
          const exists = await this.bookGenreRepository.findOne({
            where: { bookId: book.id, genreId: genre.id },
          });
          if (!exists) {
            const bookGenre = this.bookGenreRepository.create({
              bookId: book.id,
              genreId: genre.id,
            });
            await this.bookGenreRepository.save(bookGenre);
          }
        }
      }
    }

    this.logger.log('  ✅ Book genres seeded');
  }

  private async seedApplications(books: Book[], readers: User[]) {
    this.logger.log('📝 Seeding applications...');
    const applications: Application[] = [];

    
    const book0 = books.find((b) => b.title === 'The Enchanted Forest');
    if (book0) {
      
      const app1 = await this.createApplication(book0.id, readers[0].id, {
        status: ApplicationStatus.PENDING,
        message:
          'I love fantasy novels and would love to read and review this book!',
        readingStatus: ReadingStatus.NOT_STARTED,
      });
      if (app1) applications.push(app1);

      
      const app2 = await this.createApplication(book0.id, readers[1].id, {
        status: ApplicationStatus.APPROVED,
        message: 'This sounds like an amazing story!',
        readingStatus: ReadingStatus.CURRENTLY_READING,
        respondedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        copySentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        copyReceivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        readingStartedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      if (app2) applications.push(app2);

      
      const app3 = await this.createApplication(book0.id, readers[2].id, {
        status: ApplicationStatus.APPROVED,
        message: "I'm very interested in this book.",
        readingStatus: ReadingStatus.FOR_REVIEW,
        respondedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        copySentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        copyReceivedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        readingStartedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        readingCompletedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });
      if (app3) applications.push(app3);

      
      const app4 = await this.createApplication(book0.id, readers[3].id, {
        status: ApplicationStatus.REJECTED,
        message: 'I would love to read this!',
        readingStatus: ReadingStatus.NOT_STARTED,
        respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        authorNotes: "Sorry, we've reached our limit for this book.",
      });
      if (app4) applications.push(app4);
    }

    
    const book1 = books.find((b) => b.title === "Dragon's Legacy");
    if (book1) {
      
      const app5 = await this.createApplication(book1.id, readers[0].id, {
        status: ApplicationStatus.APPROVED,
        message: "I'm a huge fan of fantasy series!",
        readingStatus: ReadingStatus.REVIEWED,
        respondedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        copySentAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
        copyReceivedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        readingStartedAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000),
        readingCompletedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        reviewSubmittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });
      if (app5) applications.push(app5);

      
      const app6 = await this.createApplication(book1.id, readers[1].id, {
        status: ApplicationStatus.WITHDRAWN,
        message: 'I applied but changed my mind.',
        readingStatus: ReadingStatus.NOT_STARTED,
      });
      if (app6) applications.push(app6);
    }

    
    const book2 = books.find((b) => b.title === 'Mystic Realms');
    if (book2) {
      const app7 = await this.createApplication(book2.id, readers[2].id, {
        status: ApplicationStatus.APPROVED,
        message: 'This sounds fascinating!',
        readingStatus: ReadingStatus.CURRENTLY_READING,
        respondedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        copySentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        copyReceivedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        readingStartedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });
      if (app7) applications.push(app7);

      const app8 = await this.createApplication(book2.id, readers[4].id, {
        status: ApplicationStatus.PENDING,
        message: "I'd love to review this book.",
        readingStatus: ReadingStatus.NOT_STARTED,
      });
      if (app8) applications.push(app8);
    }

    
    const book3 = books.find((b) => b.title === 'Neural Networks');
    if (book3) {
      const app9 = await this.createApplication(book3.id, readers[1].id, {
        status: ApplicationStatus.APPROVED,
        message: 'Sci-fi is my favorite genre!',
        readingStatus: ReadingStatus.FOR_REVIEW,
        respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        copySentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        copyReceivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        readingStartedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        readingCompletedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });
      if (app9) applications.push(app9);
    }

    
    const book4 = books.find((b) => b.title === 'Victorian Hearts');
    if (book4) {
      const app10 = await this.createApplication(book4.id, readers[3].id, {
        status: ApplicationStatus.APPROVED,
        message: 'I love historical romance!',
        readingStatus: ReadingStatus.CURRENTLY_READING,
        respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        copySentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        copyReceivedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        readingStartedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      });
      if (app10) applications.push(app10);
    }

    this.logger.log(`  ✅ Seeded ${applications.length} applications`);
    return applications;
  }

  private async createApplication(
    bookId: string,
    readerId: string,
    data: {
      status: ApplicationStatus;
      message: string;
      readingStatus: ReadingStatus;
      respondedAt?: Date;
      copySentAt?: Date;
      copyReceivedAt?: Date;
      readingStartedAt?: Date;
      readingCompletedAt?: Date;
      reviewSubmittedAt?: Date;
      authorNotes?: string;
    },
  ): Promise<Application | null> {
    const exists = await this.applicationRepository.findOne({
      where: { bookId, readerId },
    });
    if (exists) {
      return null;
    }

    const application = this.applicationRepository.create({
      bookId,
      readerId,
      status: data.status,
      applicationMessage: data.message,
      readingStatus: data.readingStatus,
      respondedAt: data.respondedAt,
      copySentAt: data.copySentAt,
      copyReceivedAt: data.copyReceivedAt,
      readingStartedAt: data.readingStartedAt,
      readingCompletedAt: data.readingCompletedAt,
      reviewSubmittedAt: data.reviewSubmittedAt,
      authorNotes: data.authorNotes,
    });

    return await this.applicationRepository.save(application);
  }

  private async seedReviews(applications: Application[]) {
    this.logger.log('⭐ Seeding reviews...');
    const reviewedApplications = applications.filter(
      (app) =>
        app.readingStatus === ReadingStatus.REVIEWED &&
        app.status === ApplicationStatus.APPROVED,
    );

    const reviewData = [
      {
        application: reviewedApplications[0],
        rating: 5,
        reviewType: 'text' as ReviewType,
        reviewContent:
          "Absolutely loved this book! The world-building was incredible and the characters were well-developed. The magical forest setting was described beautifully, and I couldn't put it down. Highly recommend!",
        wordCount: 45,
        isPublic: true,
      },
    ];

    for (const reviewInfo of reviewData) {
      if (!reviewInfo.application) continue;

      const exists = await this.reviewRepository.findOne({
        where: { applicationId: reviewInfo.application.id },
      });
      if (exists) continue;

      const review = this.reviewRepository.create({
        applicationId: reviewInfo.application.id,
        rating: reviewInfo.rating,
        reviewType: reviewInfo.reviewType,
        reviewContent: reviewInfo.reviewContent,
        wordCount: reviewInfo.wordCount,
        isPublic: reviewInfo.isPublic,
      });

      await this.reviewRepository.save(review);
      this.logger.log(
        `  ✅ Seeded review for application ${reviewInfo.application.id}`,
      );
    }

    this.logger.log('  ✅ Reviews seeded');
  }

  private async seedFriends(readers: User[]) {
    this.logger.log('👫 Seeding friends...');

    
    const friendData = [
      
      {
        requester: readers[0],
        addressee: readers[1],
        status: FriendStatus.ACCEPTED,
      },
      {
        requester: readers[0],
        addressee: readers[2],
        status: FriendStatus.ACCEPTED,
      },
      {
        requester: readers[1],
        addressee: readers[2],
        status: FriendStatus.ACCEPTED,
      },

      
      {
        requester: readers[2],
        addressee: readers[3],
        status: FriendStatus.PENDING,
      },
      {
        requester: readers[3],
        addressee: readers[4],
        status: FriendStatus.PENDING,
      },
    ];

    for (const friendInfo of friendData) {
      const exists = await this.friendRepository.findOne({
        where: [
          {
            requesterId: friendInfo.requester.id,
            addresseeId: friendInfo.addressee.id,
          },
          {
            requesterId: friendInfo.addressee.id,
            addresseeId: friendInfo.requester.id,
          },
        ],
      });
      if (exists) continue;

      const friend = this.friendRepository.create({
        requesterId: friendInfo.requester.id,
        addresseeId: friendInfo.addressee.id,
        status: friendInfo.status,
      });

      await this.friendRepository.save(friend);
      this.logger.log(
        `  ✅ Seeded friend relationship: ${friendInfo.requester.username} -> ${friendInfo.addressee.username} (${friendInfo.status})`,
      );
    }

    this.logger.log('  ✅ Friends seeded');
  }
}
