import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
  ForbiddenException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  In,
  LessThan,
  IsNull,
  Not,
  And,
} from 'typeorm';
import { PaginateQuery, paginate, FilterOperator } from 'nestjs-paginate';
import { Application } from './entity/application.entity';
import { Book } from '../books/entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { Review } from '../reviews/entity/review.entity';
import { ApplicationStatus, ReadingStatus } from './enums';
import { BookStatus, SelectionMethod } from '../books/enums';
import {
  CreateApplicationDto,
  BulkActionDto,
  UpdateReadingStatusDto,
  BulkMarkSentDto,
  UpdateApplicationCompleteDto,
} from './dto';
import { ApplicationErrors } from './errors';
import { BookErrors } from '../books/errors/book-errors';
import { ensureAuthor } from '../common/utils/auth.util';
import { UserType } from '../users/enums';
import { UserActivityService } from '../user-activity/user-activity.service';
import {
  ApplicationValidationHelper,
  ApplicationBookHelper,
  ApplicationNotificationHelper,
  ApplicationSanitizationHelper,
  ApplicationAddressHelper,
} from './helpers';
import { IApplicationNotificationService } from './interfaces/notification-service.interface';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserAddress)
    private readonly userAddressRepo: Repository<UserAddress>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    private readonly dataSource: DataSource,
    @Optional()
    @Inject('NotificationService')
    private readonly notificationService?: IApplicationNotificationService,
    @Optional()
    @Inject(forwardRef(() => UserActivityService))
    private readonly userActivityService?: UserActivityService,
  ) {}

  async create(
    readerId: string,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    const user = await this.userRepo.findOne({ where: { id: readerId } });
    ApplicationValidationHelper.validateUserForApplication(user);

    const existing = await this.applicationRepo.findOne({
      where: { readerId, bookId: dto.bookId },
    });
    ApplicationValidationHelper.validateApplicationDoesNotExist(existing);

    const { saved, bookTitle, status } = await this.dataSource.transaction(
      async (manager) => {
        const book = await manager.findOne(Book, {
          where: { id: dto.bookId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!book) {
          throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
        }

        ApplicationValidationHelper.validateBookForApplication(book);
        ApplicationValidationHelper.validateUserAgeForBook(user!, book);

        const { status, respondedAt, copySentAt } =
          await this.resolveFirstComeStatus(manager.getRepository(Book), book);

        const application = await manager.save(Application, {
          readerId,
          bookId: dto.bookId,
          applicationMessage: dto.applicationMessage,
          status,
          respondedAt,
          copySentAt,
        });

        return {
          saved: application,
          bookTitle: book.title,
          status,
        };
      },
    );

    await this.logBookAppliedActivity(readerId, dto.bookId, saved.id);

    if (status === ApplicationStatus.APPROVED) {
      await ApplicationNotificationHelper.sendStatusNotification(
        this.notificationService,
        saved,
        bookTitle,
        this.logger,
      );
    }

    return this.findApplicationWithRelations(saved.id);
  }

  async findMyApplications(readerId: string, query: PaginateQuery) {
    const result = await paginate(query, this.applicationRepo, {
      sortableColumns: ['appliedAt', 'status', 'readingStatus'],
      searchableColumns: [],
      defaultSortBy: [['appliedAt', 'DESC']],
      filterableColumns: {
        status: [FilterOperator.EQ],
        readingStatus: [FilterOperator.EQ],
        'book.status': [FilterOperator.EQ],
        'book.distributionType': [FilterOperator.EQ],
        'book.ageRating': [FilterOperator.EQ],
      },
      relations: {
        book: {
          author: true,
        },
        review: true,
      },
      where: {
        readerId,
      },
      defaultLimit: 20,
      maxLimit: 100,
    });

    const sanitizedApplications =
      ApplicationSanitizationHelper.sanitizeApplications(result.data, false);

    return { ...result, data: sanitizedApplications };
  }

  async checkApplication(readerId: string, bookId: string) {
    const application = await this.applicationRepo.findOne({
      where: { readerId, bookId },
      relations: ['book'],
    });

    if (!application) {
      return {
        hasApplied: false,
        application: null,
      };
    }

    ApplicationSanitizationHelper.sanitizeApplicationBook(application, false);

    return {
      hasApplied: true,
      application,
    };
  }

  async findOne(applicationId: string, userId: string): Promise<Application> {
    const application = await this.findApplicationOrThrow(
      { id: applicationId },
      ['book', 'book.author', 'reader', 'review'],
    );

    ApplicationValidationHelper.validateApplicationAccess(application, userId);

    const isAuthor = application.book.authorId === userId;
    ApplicationSanitizationHelper.sanitizeApplicationBook(
      application,
      isAuthor,
    );

    return application;
  }

  async update(
    applicationId: string,
    userId: string,
    userType: UserType | undefined,
    dto: UpdateApplicationCompleteDto,
  ): Promise<Application> {
    let application = await this.findApplicationOrThrow({ id: applicationId }, [
      'book',
      'book.author',
    ]);

    const isReader = application.readerId === userId;
    const isAuthor =
      application.book.authorId === userId && userType === UserType.AUTHOR;

    if (dto.applicationMessage !== undefined) {
      this.validateReaderCanUpdateMessage(isReader, application);
      application.applicationMessage = dto.applicationMessage;
    }

    let statusChanged = false;
    if (dto.status !== undefined) {
      if (!isAuthor) {
        throw new ForbiddenException(BookErrors.AUTHOR_ACCESS_REQUIRED);
      }
      this.validateNotLotterySelection(application.book);
      await this.dataSource.transaction(async (manager) => {
        await this.changePendingApplicationStatus(
          manager,
          application.id,
          dto.status!,
          userId,
          dto.authorNotes,
        );
      });
      application = await this.findApplicationOrThrow({ id: applicationId }, [
        'book',
        'book.author',
      ]);
      statusChanged = true;
    }

    if (dto.readingStatus !== undefined) {
      this.handleReadingStatusUpdate(application, isReader, dto.readingStatus);
    }

    if (dto.markCopySent) {
      this.validateAuthorCanMarkSent(isAuthor, application);
      application.copySentAt = new Date();
    }

    if (dto.markCopyReceived) {
      this.validateReaderCanMarkReceived(isReader, application);
      application.copyReceivedAt = new Date();
    }

    const saved = await this.applicationRepo.save(application);

    if (statusChanged) {
      await ApplicationNotificationHelper.sendStatusNotification(
        this.notificationService,
        saved,
        application.book.title,
        this.logger,
      );
    }

    return saved;
  }

  async getBookApplications(
    bookId: string,
    authorId: string,
    query: PaginateQuery,
  ) {
    const book = await this.getBookOrThrow(bookId);
    ApplicationValidationHelper.validateBookOwnership(book, authorId);

    const result = await paginate(query, this.applicationRepo, {
      sortableColumns: ['appliedAt', 'readingStatus', 'status'],
      searchableColumns: [],
      defaultSortBy: [['appliedAt', 'DESC']],
      filterableColumns: {
        status: [FilterOperator.EQ],
        readingStatus: [FilterOperator.EQ],
      },
      relations: {
        book: {
          author: true,
        },
        reader: true,
        review: true,
      },
      where: {
        bookId,
      },
      defaultLimit: 20,
      maxLimit: 100,
    });

    await ApplicationAddressHelper.attachReaderAddresses(
      result.data,
      book,
      this.userAddressRepo,
    );

    return result;
  }

  async bulkUpdateApplicationStatus(
    bookId: string,
    authorId: string,
    userType?: string,
    dto?: BulkActionDto,
  ): Promise<{ updated: number }> {
    ensureAuthor(userType);

    if (!dto?.applicationIds?.length) {
      throw new NotFoundException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    const { updated, applications, bookTitle } =
      await this.dataSource.transaction(async (manager) => {
        const book = await manager.findOne(Book, {
          where: { id: bookId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!book) {
          throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
        }

        ApplicationValidationHelper.validateBookOwnership(book, authorId);
        this.validateNotLotterySelection(book);

        const applications = await manager.find(Application, {
          where: {
            id: In(dto.applicationIds),
            bookId,
            status: ApplicationStatus.PENDING,
          },
        });

        if (applications.length !== dto.applicationIds.length) {
          throw new NotFoundException(ApplicationErrors.APPLICATION_NOT_FOUND);
        }

        if (dto.action === ApplicationStatus.APPROVED) {
          const reserved = await ApplicationBookHelper.tryReserveCopies(
            manager.getRepository(Book),
            book.id,
            applications.length,
          );
          if (!reserved) {
            throw new ConflictException(
              ApplicationErrors.APPLICATION_NO_AVAILABLE_COPIES,
            );
          }
        }

        const now = new Date();
        const copySentAt = ApplicationBookHelper.shouldSetCopySentAt(book)
          ? now
          : undefined;

        for (const application of applications) {
          ApplicationValidationHelper.validateApplicationStatus(
            application,
            ApplicationStatus.PENDING,
            ApplicationErrors.APPLICATION_NOT_PENDING,
          );
          this.assignRespondedStatus(
            application,
            dto.action,
            authorId,
            dto.authorNotes,
          );
          if (copySentAt) {
            application.copySentAt = copySentAt;
          }
        }

        await manager.save(Application, applications);

        return {
          updated: applications.length,
          applications,
          bookTitle: book.title,
        };
      });

    await ApplicationNotificationHelper.sendBulkStatusNotifications(
      this.notificationService,
      applications,
      bookTitle,
      this.logger,
    );

    return { updated };
  }

  async markCopySent(
    applicationId: string,
    authorId: string,
    userType?: string,
  ): Promise<Application> {
    ensureAuthor(userType);

    const application = await this.findApplicationOrThrow(
      { id: applicationId },
      ['book', 'book.author'],
    );

    ApplicationValidationHelper.validateBookOwnership(
      application.book,
      authorId,
    );
    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.APPROVED,
      ApplicationErrors.APPLICATION_NOT_APPROVED,
    );

    application.copySentAt = new Date();
    return await this.applicationRepo.save(application);
  }

  async markCopyReceived(
    applicationId: string,
    readerId: string,
  ): Promise<Application> {
    const application = await this.findApplicationOrThrow(
      { id: applicationId, readerId },
      ['book', 'book.author'],
    );

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.APPROVED,
      ApplicationErrors.APPLICATION_NOT_APPROVED,
    );

    application.copyReceivedAt = new Date();
    return await this.applicationRepo.save(application);
  }

  async updateReadingStatus(
    applicationId: string,
    readerId: string,
    dto: UpdateReadingStatusDto,
  ): Promise<Application> {
    const application = await this.findApplicationOrThrow(
      { id: applicationId, readerId },
      ['book', 'book.author'],
    );

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.APPROVED,
      ApplicationErrors.APPLICATION_NOT_APPROVED,
    );

    application.readingStatus = dto.readingStatus;
    this.updateReadingTimestamps(application, dto.readingStatus);

    const saved = await this.applicationRepo.save(application);

    await this.logReadingStatusActivity(
      readerId,
      application,
      dto.readingStatus,
    );

    return saved;
  }

  async withdrawApplication(
    applicationId: string,
    readerId: string,
  ): Promise<Application> {
    const application = await this.findApplicationOrThrow(
      { id: applicationId, readerId },
      ['book', 'book.author'],
    );

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.PENDING,
      ApplicationErrors.APPLICATION_CANNOT_WITHDRAW,
    );

    application.status = ApplicationStatus.WITHDRAWN;
    return await this.applicationRepo.save(application);
  }

  async bulkMarkCopySent(
    bookId: string,
    authorId: string,
    userType: UserType | undefined,
    dto: BulkMarkSentDto,
  ): Promise<{ updated: number }> {
    ensureAuthor(userType);

    const book = await this.getBookOrThrow(bookId);
    ApplicationValidationHelper.validateBookOwnership(book, authorId);

    const applications = await this.applicationRepo.find({
      where: {
        id: In(dto.applicationIds),
        bookId,
        status: ApplicationStatus.APPROVED,
      },
    });

    if (applications.length !== dto.applicationIds.length) {
      throw new NotFoundException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    await this.applicationRepo.update(
      { id: In(dto.applicationIds) },
      { copySentAt: new Date() },
    );

    return { updated: applications.length };
  }

  async getOverdueReviews(authorId: string): Promise<Application[]> {
    const now = new Date();

    const applications = await this.applicationRepo.find({
      where: {
        status: ApplicationStatus.APPROVED,
        copyReceivedAt: Not(IsNull()),
        book: {
          authorId,
          reviewDeadline: And(Not(IsNull()), LessThan(now)),
        },
      },
      relations: ['book', 'reader'],
    });

    if (applications.length === 0) {
      return [];
    }

    const applicationIds = applications.map((app) => app.id);
    const reviews = await this.reviewRepo.find({
      where: { applicationId: In(applicationIds) },
      select: ['applicationId'],
    });

    const reviewedApplicationIds = new Set(
      reviews.map((review) => review.applicationId),
    );

    return applications.filter((app) => !reviewedApplicationIds.has(app.id));
  }

  async runLotterySelection(
    bookId: string,
    authorId: string,
  ): Promise<{
    approved: number;
    rejected: number;
    message: string;
  }> {
    const txResult = await this.dataSource.transaction(async (manager) => {
      const book = await manager.findOne(Book, {
        where: { id: bookId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!book) {
        throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
      }

      ApplicationValidationHelper.validateBookOwnership(book, authorId);
      this.validateLotterySelection(book);

      if (book.lotteryRunAt) {
        throw new BadRequestException(
          'Lottery has already been run for this book',
        );
      }

      const pendingApplications = await manager.find(Application, {
        where: {
          bookId,
          status: ApplicationStatus.PENDING,
        },
        order: { appliedAt: 'ASC' },
      });

      if (pendingApplications.length === 0) {
        return {
          approved: 0,
          rejected: 0,
          message: 'No pending applications to process',
          bookTitle: book.title,
          winnersToNotify: [] as Application[],
          losersToNotify: [] as Application[],
        };
      }

      book.lotteryRunAt = new Date();
      await manager.save(Book, book);

      const { winners, losers } = this.selectLotteryWinners(
        pendingApplications,
        book.availableCopies,
      );

      const bookRepo = manager.getRepository(Book);
      const applicationRepo = manager.getRepository(Application);

      const winnersToNotify = await this.processLotteryWinners(
        winners,
        book,
        applicationRepo,
        bookRepo,
      );
      const losersToNotify = await this.processLotteryLosers(
        losers,
        applicationRepo,
      );

      if (book.status === BookStatus.ACTIVE) {
        book.status = BookStatus.IN_PROGRESS;
        await manager.save(Book, book);
      }

      return {
        approved: winners.length,
        rejected: losers.length,
        message: `Lottery completed: ${winners.length} approved, ${losers.length} rejected`,
        bookTitle: book.title,
        winnersToNotify,
        losersToNotify,
      };
    });

    if (txResult.winnersToNotify.length > 0) {
      await ApplicationNotificationHelper.sendBulkStatusNotifications(
        this.notificationService,
        txResult.winnersToNotify,
        txResult.bookTitle,
        this.logger,
      );
    }

    if (txResult.losersToNotify.length > 0) {
      await ApplicationNotificationHelper.sendBulkStatusNotifications(
        this.notificationService,
        txResult.losersToNotify,
        txResult.bookTitle,
        this.logger,
      );
    }

    return {
      approved: txResult.approved,
      rejected: txResult.rejected,
      message: txResult.message,
    };
  }

  private async getBookOrThrow(bookId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }
    return book;
  }

  private async findApplicationOrThrow(
    where: Record<string, unknown>,
    relations: string[] = ['book', 'book.author'],
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where,
      relations,
    });

    if (!application) {
      throw new NotFoundException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    return application;
  }

  private async resolveFirstComeStatus(
    bookRepo: Repository<Book>,
    book: Book,
  ): Promise<{
    status: ApplicationStatus;
    respondedAt: Date | null;
    copySentAt: Date | null;
  }> {
    if (book.selectionMethod !== SelectionMethod.FIRST_COME) {
      return {
        status: ApplicationStatus.PENDING,
        respondedAt: null,
        copySentAt: null,
      };
    }

    const reserved = await ApplicationBookHelper.tryReserveCopies(
      bookRepo,
      book.id,
      1,
    );

    if (!reserved) {
      return {
        status: ApplicationStatus.PENDING,
        respondedAt: null,
        copySentAt: null,
      };
    }

    const now = new Date();
    return {
      status: ApplicationStatus.APPROVED,
      respondedAt: now,
      copySentAt: ApplicationBookHelper.shouldSetCopySentAt(book) ? now : null,
    };
  }

  private async logBookAppliedActivity(
    readerId: string,
    bookId: string,
    applicationId: string,
  ): Promise<void> {
    if (!this.userActivityService) {
      return;
    }

    try {
      await this.userActivityService.logBookApplied(
        readerId,
        bookId,
        applicationId,
      );
    } catch (error) {
      this.logger.error(`Failed to log book applied activity: ${error}`);
    }
  }

  private async findApplicationWithRelations(
    applicationId: string,
  ): Promise<Application> {
    return this.findApplicationOrThrow({ id: applicationId }, [
      'book',
      'book.author',
    ]);
  }

  private validateReaderCanUpdateMessage(
    isReader: boolean,
    application: Application,
  ): void {
    if (!isReader) {
      throw new ForbiddenException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.PENDING,
      ApplicationErrors.APPLICATION_CANNOT_UPDATE,
    );
  }

  private assignRespondedStatus(
    application: Application,
    status: ApplicationStatus,
    authorId: string,
    authorNotes?: string,
  ): void {
    application.status = status;
    application.authorNotes = authorNotes ?? application.authorNotes;
    application.respondedAt = new Date();
    application.respondedById = authorId;
  }

  private async changePendingApplicationStatus(
    manager: EntityManager,
    applicationId: string,
    status: ApplicationStatus,
    authorId: string,
    authorNotes?: string,
  ): Promise<void> {
    const application = await manager.findOne(Application, {
      where: { id: applicationId },
      lock: { mode: 'pessimistic_write' },
      relations: ['book'],
    });

    if (!application) {
      throw new NotFoundException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    const book = await manager.findOne(Book, {
      where: { id: application.bookId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!book) {
      throw new NotFoundException(BookErrors.BOOK_NOT_FOUND);
    }

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.PENDING,
      ApplicationErrors.APPLICATION_NOT_PENDING,
    );

    if (status === ApplicationStatus.APPROVED) {
      const reserved = await ApplicationBookHelper.tryReserveCopies(
        manager.getRepository(Book),
        book.id,
        1,
      );
      if (!reserved) {
        throw new ConflictException(
          ApplicationErrors.APPLICATION_NO_AVAILABLE_COPIES,
        );
      }
    }

    this.assignRespondedStatus(application, status, authorId, authorNotes);

    if (
      status === ApplicationStatus.APPROVED &&
      ApplicationBookHelper.shouldSetCopySentAt(book)
    ) {
      application.copySentAt = new Date();
    }

    await manager.save(Application, application);
  }

  private handleReadingStatusUpdate(
    application: Application,
    isReader: boolean,
    readingStatus: ReadingStatus,
  ): void {
    if (!isReader) {
      throw new ForbiddenException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.APPROVED,
      ApplicationErrors.APPLICATION_NOT_APPROVED,
    );

    application.readingStatus = readingStatus;
    this.updateReadingTimestamps(application, readingStatus);
  }

  private updateReadingTimestamps(
    application: Application,
    readingStatus: ReadingStatus,
  ): void {
    if (
      readingStatus === ReadingStatus.CURRENTLY_READING &&
      !application.readingStartedAt
    ) {
      application.readingStartedAt = new Date();
    }

    if (readingStatus === ReadingStatus.FOR_REVIEW) {
      application.readingCompletedAt = new Date();
    }
  }

  private async logReadingStatusActivity(
    readerId: string,
    application: Application,
    readingStatus: ReadingStatus,
  ): Promise<void> {
    if (!this.userActivityService) {
      return;
    }

    try {
      if (
        readingStatus === ReadingStatus.CURRENTLY_READING &&
        application.readingStartedAt
      ) {
        await this.userActivityService.logBookStarted(
          readerId,
          application.bookId,
          application.id,
        );
      } else if (
        readingStatus === ReadingStatus.FOR_REVIEW &&
        application.readingCompletedAt
      ) {
        await this.userActivityService.logBookCompleted(
          readerId,
          application.bookId,
          application.id,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to log reading status activity: ${error}`);
    }
  }

  private validateAuthorCanMarkSent(
    isAuthor: boolean,
    application: Application,
  ): void {
    if (!isAuthor) {
      throw new ForbiddenException(BookErrors.AUTHOR_ACCESS_REQUIRED);
    }

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.APPROVED,
      ApplicationErrors.APPLICATION_NOT_APPROVED,
    );
  }

  private validateReaderCanMarkReceived(
    isReader: boolean,
    application: Application,
  ): void {
    if (!isReader) {
      throw new ForbiddenException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.APPROVED,
      ApplicationErrors.APPLICATION_NOT_APPROVED,
    );
  }

  private validateNotLotterySelection(book: Book): void {
    if (book.selectionMethod === SelectionMethod.LOTTERY) {
      throw new BadRequestException(
        ApplicationErrors.APPLICATION_CANNOT_MANAGE_LOTTERY,
      );
    }
  }

  private async findPendingApplications(
    applicationIds: string[],
    bookId: string,
  ): Promise<Application[]> {
    return this.applicationRepo.find({
      where: {
        id: In(applicationIds),
        bookId,
        status: ApplicationStatus.PENDING,
      },
    });
  }

  private validateLotterySelection(book: Book): void {
    if (book.selectionMethod !== SelectionMethod.LOTTERY) {
      throw new BadRequestException(
        'This book does not use lottery selection method',
      );
    }

    const now = new Date();
    if (book.applicationDeadline > now) {
      throw new BadRequestException(
        'Application deadline has not passed yet. Lottery can only be run after the deadline.',
      );
    }
  }

  private selectLotteryWinners(
    applications: Application[],
    availableCopies: number,
  ): { winners: Application[]; losers: Application[] } {
    const shuffled = [...applications];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const winners = shuffled.slice(0, availableCopies);
    const losers = shuffled.slice(availableCopies);
    return { winners, losers };
  }

  private async processLotteryWinners(
    winners: Application[],
    book: Book,
    applicationRepo: Repository<Application>,
    bookRepo: Repository<Book>,
  ): Promise<Application[]> {
    if (winners.length === 0) {
      return [];
    }

    const now = new Date();
    const updateData: Partial<Application> = {
      status: ApplicationStatus.APPROVED,
      respondedAt: now,
    };

    if (ApplicationBookHelper.shouldSetCopySentAt(book)) {
      updateData.copySentAt = now;
    }

    const reserved = await ApplicationBookHelper.tryReserveCopies(
      bookRepo,
      book.id,
      winners.length,
    );

    if (!reserved) {
      throw new ConflictException(
        ApplicationErrors.APPLICATION_NO_AVAILABLE_COPIES,
      );
    }

    await applicationRepo.update(
      { id: In(winners.map((w) => w.id)) },
      updateData,
    );

    return winners.map(
      (w) =>
        ({
          ...w,
          status: ApplicationStatus.APPROVED,
          respondedAt: now,
          copySentAt: updateData.copySentAt,
        }) as Application,
    );
  }

  private async processLotteryLosers(
    losers: Application[],
    applicationRepo: Repository<Application>,
  ): Promise<Application[]> {
    if (losers.length === 0) {
      return [];
    }

    const now = new Date();
    await applicationRepo.update(
      { id: In(losers.map((l) => l.id)) },
      {
        status: ApplicationStatus.REJECTED,
        respondedAt: now,
      },
    );

    return losers.map(
      (l) =>
        ({
          ...l,
          status: ApplicationStatus.REJECTED,
          respondedAt: now,
        }) as Application,
    );
  }
}
