import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
  ForbiddenException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, IsNull, Not, And } from 'typeorm';
import { PaginateQuery, paginate, FilterOperator } from 'nestjs-paginate';
import { Application } from './entity/application.entity';
import { Book } from '../books/entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { Review } from '../reviews/entity/review.entity';
import { ApplicationStatus, ReadingStatus } from './enums';
import { SelectionMethod } from '../books/enums';
import {
  CreateApplicationDto,
  ApplicationStatusDto,
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

    const book = await this.getBookOrThrow(dto.bookId);
    ApplicationValidationHelper.validateBookForApplication(book);

    const existing = await this.applicationRepo.findOne({
      where: { readerId, bookId: dto.bookId },
    });
    ApplicationValidationHelper.validateApplicationDoesNotExist(existing);

    ApplicationValidationHelper.validateUserAgeForBook(user!, book);

    const { status, respondedAt, copySentAt } =
      await this.handleFirstComeSelection(book);

    const saved = await this.applicationRepo.save({
      readerId,
      bookId: dto.bookId,
      applicationMessage: dto.applicationMessage,
      status,
      respondedAt,
      copySentAt,
    });

    await this.logBookAppliedActivity(readerId, book.id, saved.id);

    if (status === ApplicationStatus.APPROVED) {
      await ApplicationNotificationHelper.sendStatusNotification(
        this.notificationService,
        saved,
        book.title,
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
    const application = await this.findApplicationOrThrow(
      { id: applicationId },
      ['book', 'book.author'],
    );

    const isReader = application.readerId === userId;
    const isAuthor =
      application.book.authorId === userId && userType === UserType.AUTHOR;

    if (dto.applicationMessage !== undefined) {
      this.validateReaderCanUpdateMessage(isReader, application);
      application.applicationMessage = dto.applicationMessage;
    }

    if (dto.status !== undefined) {
      await this.handleStatusUpdate(
        application,
        isAuthor,
        userId,
        dto.status,
        dto.authorNotes,
      );
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

    return await this.applicationRepo.save(application);
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

  async updateApplicationStatus(
    applicationId: string,
    authorId: string,
    userType?: string,
    dto?: ApplicationStatusDto,
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
      ApplicationStatus.PENDING,
      ApplicationErrors.APPLICATION_NOT_PENDING,
    );

    const status = dto?.status ?? ApplicationStatus.APPROVED;
    const updateData: Partial<Application> = {
      status,
      authorNotes: dto?.authorNotes ?? application.authorNotes,
      respondedAt: new Date(),
      respondedById: authorId,
    };

    if (status === ApplicationStatus.APPROVED) {
      await ApplicationBookHelper.decrementAvailableCopies(
        this.bookRepo,
        application.bookId,
        1,
      );

      if (ApplicationBookHelper.shouldSetCopySentAt(application.book)) {
        updateData.copySentAt = new Date();
      }
    }

    Object.assign(application, updateData);
    const saved = await this.applicationRepo.save(application);

    await ApplicationNotificationHelper.sendStatusNotification(
      this.notificationService,
      saved,
      application.book.title,
      this.logger,
    );

    return saved;
  }

  async bulkUpdateApplicationStatus(
    bookId: string,
    authorId: string,
    userType?: string,
    dto?: BulkActionDto,
  ): Promise<{ updated: number }> {
    ensureAuthor(userType);

    const book = await this.getBookOrThrow(bookId);
    ApplicationValidationHelper.validateBookOwnership(book, authorId);
    this.validateNotLotterySelection(book);

    if (!dto?.applicationIds?.length) {
      throw new NotFoundException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    const applications = await this.findPendingApplications(
      dto.applicationIds,
      bookId,
    );

    if (applications.length !== dto.applicationIds.length) {
      throw new NotFoundException(ApplicationErrors.APPLICATION_NOT_FOUND);
    }

    const updatedApplications = this.updateApplicationsStatus(
      applications,
      dto.action,
      authorId,
      dto.authorNotes,
    );

    await this.applicationRepo.save(updatedApplications);

    if (dto.action === ApplicationStatus.APPROVED) {
      await this.handleBulkApproval(updatedApplications, book);
    }

    await ApplicationNotificationHelper.sendBulkStatusNotifications(
      this.notificationService,
      updatedApplications,
      book.title,
      this.logger,
    );

    return { updated: updatedApplications.length };
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
    const book = await this.getBookOrThrow(bookId);
    ApplicationValidationHelper.validateBookOwnership(book, authorId);
    this.validateLotterySelection(book);

    const pendingApplications =
      await this.findPendingApplicationsForLottery(bookId);

    if (pendingApplications.length === 0) {
      return {
        approved: 0,
        rejected: 0,
        message: 'No pending applications to process',
      };
    }

    await this.validateLotteryNotAlreadyRun(bookId);

    const { winners, losers } = this.selectLotteryWinners(
      pendingApplications,
      book.availableCopies,
    );

    await this.processLotteryWinners(winners, book);
    await this.processLotteryLosers(losers, book);

    return {
      approved: winners.length,
      rejected: losers.length,
      message: `Lottery completed: ${winners.length} approved, ${losers.length} rejected`,
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

  private async handleFirstComeSelection(book: Book): Promise<{
    status: ApplicationStatus;
    respondedAt: Date | null;
    copySentAt: Date | null;
  }> {
    if (
      book.selectionMethod !== SelectionMethod.FIRST_COME ||
      book.availableCopies <= 0
    ) {
      return {
        status: ApplicationStatus.PENDING,
        respondedAt: null,
        copySentAt: null,
      };
    }

    await ApplicationBookHelper.decrementAvailableCopies(
      this.bookRepo,
      book.id,
      1,
    );

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

  private async handleStatusUpdate(
    application: Application,
    isAuthor: boolean,
    userId: string,
    status: ApplicationStatus,
    authorNotes?: string,
  ): Promise<void> {
    if (!isAuthor) {
      throw new ForbiddenException(BookErrors.AUTHOR_ACCESS_REQUIRED);
    }

    ApplicationValidationHelper.validateApplicationStatus(
      application,
      ApplicationStatus.PENDING,
      ApplicationErrors.APPLICATION_NOT_PENDING,
    );

    this.validateNotLotterySelection(application.book);

    application.status = status;
    application.authorNotes = authorNotes ?? application.authorNotes;
    application.respondedAt = new Date();
    application.respondedById = userId;

    if (status === ApplicationStatus.APPROVED) {
      await ApplicationBookHelper.decrementAvailableCopies(
        this.bookRepo,
        application.bookId,
        1,
      );

      if (ApplicationBookHelper.shouldSetCopySentAt(application.book)) {
        application.copySentAt = new Date();
      }
    }
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

  private updateApplicationsStatus(
    applications: Application[],
    status: ApplicationStatus,
    authorId: string,
    authorNotes?: string,
  ): Application[] {
    const now = new Date();
    return applications.map((app) => {
      app.status = status;
      app.authorNotes = authorNotes ?? app.authorNotes;
      app.respondedAt = now;
      app.respondedById = authorId;
      return app;
    });
  }

  private async handleBulkApproval(
    applications: Application[],
    book: Book,
  ): Promise<void> {
    await ApplicationBookHelper.decrementAvailableCopies(
      this.bookRepo,
      book.id,
      applications.length,
    );

    const now = new Date();
    applications.forEach((app) => {
      if (ApplicationBookHelper.shouldSetCopySentAt(book)) {
        app.copySentAt = now;
      }
    });

    await this.applicationRepo.save(applications);
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

  private async findPendingApplicationsForLottery(
    bookId: string,
  ): Promise<Application[]> {
    return this.applicationRepo.find({
      where: {
        bookId,
        status: ApplicationStatus.PENDING,
      },
      order: { appliedAt: 'ASC' },
    });
  }

  private async validateLotteryNotAlreadyRun(bookId: string): Promise<void> {
    const processedCount = await this.applicationRepo.count({
      where: {
        bookId,
        status: In([ApplicationStatus.APPROVED, ApplicationStatus.REJECTED]),
      },
    });

    if (processedCount > 0) {
      throw new BadRequestException(
        'Lottery has already been run for this book',
      );
    }
  }

  private selectLotteryWinners(
    applications: Application[],
    availableCopies: number,
  ): { winners: Application[]; losers: Application[] } {
    const shuffled = [...applications].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, availableCopies);
    const losers = shuffled.slice(availableCopies);
    return { winners, losers };
  }

  private async processLotteryWinners(
    winners: Application[],
    book: Book,
  ): Promise<void> {
    const now = new Date();
    const updateData: Partial<Application> = {
      status: ApplicationStatus.APPROVED,
      respondedAt: now,
    };

    if (ApplicationBookHelper.shouldSetCopySentAt(book)) {
      updateData.copySentAt = now;
    }

    await this.applicationRepo.update(
      { id: In(winners.map((w) => w.id)) },
      updateData,
    );

    await ApplicationBookHelper.decrementAvailableCopies(
      this.bookRepo,
      book.id,
      winners.length,
    );

    await ApplicationNotificationHelper.sendBulkStatusNotifications(
      this.notificationService,
      winners.map((w) => ({
        ...w,
        status: ApplicationStatus.APPROVED,
        respondedAt: now,
        copySentAt: updateData.copySentAt,
      })) as Application[],
      book.title,
      this.logger,
    );
  }

  private async processLotteryLosers(
    losers: Application[],
    book: Book,
  ): Promise<void> {
    const now = new Date();
    await this.applicationRepo.update(
      { id: In(losers.map((l) => l.id)) },
      {
        status: ApplicationStatus.REJECTED,
        respondedAt: now,
      },
    );

    await ApplicationNotificationHelper.sendBulkStatusNotifications(
      this.notificationService,
      losers.map((l) => ({
        ...l,
        status: ApplicationStatus.REJECTED,
        respondedAt: now,
      })) as Application[],
      book.title,
      this.logger,
    );
  }
}
