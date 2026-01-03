import {
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
  BadRequestException,
  ForbiddenException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, IsNull } from 'typeorm';
import { Application } from './entity/application.entity';
import { Book } from '../books/entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../user-address/entity/user-address.entity';
import { Review } from '../reviews/entity/review.entity';
import { ApplicationStatus, ReadingStatus } from './enums';
import { SelectionMethod, AgeRating } from '../books/enums';
import {
  CreateApplicationDto,
  ApplicationStatusDto,
  BulkActionDto,
  UpdateReadingStatusDto,
  ShippingApplicationDto,
  BulkMarkSentDto,
  UpdateApplicationCompleteDto,
  FindApplicationsDto,
  FindBookApplicationsDto,
} from './dto';
import { BasePaginationDto, createPaginatedResponse } from '../common';
import { ApplicationErrorCode, ApplicationErrors } from './errors';
import { BookErrorCode, BookErrors } from '../books/errors/book-errors';
import { UserErrorCode, UserErrors } from '../users/errors/user-errors';
import { ensureAuthor } from '../common/utils/auth.util';
import { UserType } from '../users/enums';
import { UserActivityService } from '../user-activity/user-activity.service';

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
    private readonly notificationService?: {
      notifyApplicationApproved: (...args: unknown[]) => Promise<void>;
      notifyApplicationRejected: (...args: unknown[]) => Promise<void>;
    },
    @Optional()
    @Inject(forwardRef(() => UserActivityService))
    private readonly userActivityService?: UserActivityService,
  ) {}

  async create(
    readerId: string,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    const user = await this.userRepo.findOne({ where: { id: readerId } });
    if (!user) {
      const error = UserErrors[UserErrorCode.USER_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }
    if (!user.emailVerified) {
      const error =
        ApplicationErrors[
          ApplicationErrorCode.APPLICATION_EMAIL_VERIFICATION_REQUIRED
        ];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const book = await this.bookRepo.findOne({ where: { id: dto.bookId } });
    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }
    if (book.status !== 'active') {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_BOOK_NOT_ACTIVE];
      throw new BadRequestException({
        message: error.message,
        code: error.code,
      });
    }

    const existing = await this.applicationRepo.findOne({
      where: { readerId, bookId: dto.bookId },
    });

    if (existing) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_ALREADY_EXISTS];
      throw new ConflictException({ message: error.message, code: error.code });
    }

    if (book.availableCopies <= 0) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NO_AVAILABLE_COPIES];
      throw new BadRequestException({
        message: error.message,
        code: error.code,
      });
    }

    const now = new Date();
    if (book.applicationDeadline < now) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_DEADLINE_PASSED];
      throw new BadRequestException({
        message: error.message,
        code: error.code,
      });
    }

    if (!this.isUserEligibleForBook(user, book)) {
      const error =
        ApplicationErrors[
          ApplicationErrorCode.APPLICATION_AGE_RESTRICTION_VIOLATION
        ];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    let initialStatus = ApplicationStatus.PENDING;
    let respondedAt: Date | null = null;
    let copySentAt: Date | null = null;

    if (
      book.selectionMethod === SelectionMethod.FIRST_COME &&
      book.availableCopies > 0
    ) {
      initialStatus = ApplicationStatus.APPROVED;
      respondedAt = now;
      book.availableCopies -= 1;
      await this.bookRepo.save(book);
      if (book.distributionType === 'digital') {
        copySentAt = now;
      }
    }

    const application = this.applicationRepo.create({
      readerId,
      bookId: dto.bookId,
      applicationMessage: dto.applicationMessage,
      status: initialStatus,
      respondedAt,
      copySentAt,
    });

    const saved = await this.applicationRepo.save(application);

    if (this.userActivityService) {
      try {
        await this.userActivityService.logBookApplied(
          readerId,
          book.id,
          saved.id,
        );
      } catch (error) {
        this.logger.error(
          `Failed to log book applied activity: ${error}`,
          error?.stack,
        );
      }
    }

    if (
      initialStatus === ApplicationStatus.APPROVED &&
      this.notificationService
    ) {
      try {
        await this.notificationService.notifyApplicationApproved(
          readerId,
          book.id,
          book.title,
          saved.id,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send approval notification: ${error}`,
          error?.stack,
        );
      }
    }

    return (
      (await this.applicationRepo.findOne({
        where: { id: saved.id },
        relations: ['book', 'book.author'],
      })) || saved
    );
  }

  async findMyApplications(readerId: string, dto: FindApplicationsDto) {
    if (!readerId) {
      throw new BadRequestException('Reader ID is required');
    }

    const skip = dto.skip ?? 0;
    const take = dto.take ?? 20;

    const qb = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.book', 'book')
      .leftJoinAndSelect('book.author', 'author')
      .leftJoinAndSelect('application.review', 'review')
      .where('application.readerId = :readerId', { readerId });

    if (dto.status) {
      qb.andWhere('application.status = :status', { status: dto.status });
    }

    if (dto.readingStatus) {
      qb.andWhere('application.readingStatus = :readingStatus', {
        readingStatus: dto.readingStatus,
      });
    }

    if (dto.activeBooksOnly) {
      qb.andWhere('book.status = :bookStatus', { bookStatus: 'active' });
    }

    if (dto.distributionType) {
      qb.andWhere('book.distributionType = :distributionType', {
        distributionType: dto.distributionType,
      });
    }

    if (dto.ageRating) {
      qb.andWhere('book.ageRating = :ageRating', { ageRating: dto.ageRating });
    }

    if (dto.genres && dto.genres.length > 0) {
      const genreIds = dto.genres;

      if (genreIds.length > 0) {
        if (genreIds.length === 1) {
          qb.andWhere(
            'EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = book.id AND bg.genre_id = :genreId)',
            { genreId: genreIds[0] },
          );
        } else {
          qb.andWhere(
            `(SELECT COUNT(DISTINCT bg.genre_id) FROM book_genres bg WHERE bg.book_id = book.id AND bg.genre_id IN (:...genreIds)) = :genreCount`,
            { genreIds, genreCount: genreIds.length },
          );
        }
      }
    }

    if (dto.minAvgRating !== undefined || dto.maxAvgRating !== undefined) {
      const avgRatingSubquery = `
        SELECT AVG(r.rating)
        FROM reviews r
        INNER JOIN applications a ON a.id = r.application_id
        WHERE a.book_id = book.id
      `;

      if (dto.minAvgRating !== undefined) {
        qb.andWhere(`(${avgRatingSubquery}) >= :minAvgRating`, {
          minAvgRating: dto.minAvgRating,
        });
      }
      if (dto.maxAvgRating !== undefined) {
        qb.andWhere(`(${avgRatingSubquery}) <= :maxAvgRating`, {
          maxAvgRating: dto.maxAvgRating,
        });
      }
    }

    qb.orderBy('application.appliedAt', 'DESC');

    const countQb = qb.clone();
    const total = await countQb.getCount();

    qb.skip(skip).take(take);

    const applications = await qb.getMany();

    const sanitizedApplications = applications.map((app) => {
      const isApproved = app.status === ApplicationStatus.APPROVED;
      const isReviewed = app.readingStatus === ReadingStatus.REVIEWED;

      if (!isApproved && !isReviewed) {
        if (app.book) {
          const sanitizedBook = { ...app.book };
          delete sanitizedBook.fileUrl;
          delete sanitizedBook.fileSize;
          delete sanitizedBook.fileType;
          app.book = sanitizedBook as Book;
        }
      }
      return app;
    });

    return createPaginatedResponse(sanitizedApplications, total, skip, take);
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

    const isApproved = application.status === ApplicationStatus.APPROVED;
    const isReviewed = application.readingStatus === ReadingStatus.REVIEWED;

    if (!isApproved && !isReviewed) {
      if (application.book) {
        const sanitizedBook = { ...application.book };
        delete sanitizedBook.fileUrl;
        delete sanitizedBook.fileSize;
        delete sanitizedBook.fileType;
        application.book = sanitizedBook as Book;
      }
    }

    return {
      hasApplied: true,
      application,
    };
  }

  async findOne(
    applicationId: string,
    userId: string,
    userType?: string,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['book', 'book.author', 'reader', 'review'],
    });

    if (!application) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (
      application.readerId !== userId &&
      application.book.authorId !== userId
    ) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_ACCESS_DENIED];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const isAuthor = application.book.authorId === userId;
    const isApproved = application.status === ApplicationStatus.APPROVED;
    const isReviewed = application.readingStatus === ReadingStatus.REVIEWED;

    if (!isAuthor && !isApproved && !isReviewed) {
      if (application.book) {
        const sanitizedBook = { ...application.book };
        delete sanitizedBook.fileUrl;
        delete sanitizedBook.fileSize;
        delete sanitizedBook.fileType;
        application.book = sanitizedBook as Book;
      }
    }

    return application;
  }

  async update(
    applicationId: string,
    userId: string,
    userType: UserType | undefined,
    dto: UpdateApplicationCompleteDto,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['book', 'book.author'],
    });

    if (!application) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    const isReader = application.readerId === userId;
    const isAuthor =
      application.book.authorId === userId && userType === 'author';

    if (dto.applicationMessage !== undefined) {
      if (!isReader) {
        const error =
          ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
        throw new ForbiddenException({
          message: 'Only the applicant can update the message',
          code: error.code,
        });
      }
      if (application.status !== 'pending') {
        const error =
          ApplicationErrors[ApplicationErrorCode.APPLICATION_CANNOT_UPDATE];
        throw new ForbiddenException({
          message: 'Can only update pending applications',
          code: error.code,
        });
      }
      application.applicationMessage = dto.applicationMessage;
    }

    if (dto.status !== undefined) {
      if (!isAuthor) {
        const error = BookErrors[BookErrorCode.AUTHOR_ACCESS_REQUIRED];
        throw new ForbiddenException({
          message: error.message,
          code: error.code,
        });
      }
      if (application.status !== 'pending') {
        const error =
          ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_PENDING];
        throw new ForbiddenException({
          message: 'Can only update pending applications',
          code: error.code,
        });
      }
      if (application.book.selectionMethod === SelectionMethod.LOTTERY) {
        throw new BadRequestException(
          'Cannot manually approve or reject applications for books with lottery selection. Please use the run-lottery endpoint after the application deadline.',
        );
      }
      application.status = dto.status;
      application.authorNotes = dto.authorNotes ?? application.authorNotes;
      application.respondedAt = new Date();
      application.respondedById = userId;

      if (application.status === ApplicationStatus.APPROVED) {
        await this.bookRepo.decrement(
          { id: application.bookId },
          'availableCopies',
          1,
        );
        if (application.book.distributionType === 'digital') {
          application.copySentAt = new Date();
        }
      }

      if (this.notificationService) {
        const book = await this.bookRepo.findOne({
          where: { id: application.bookId },
        });
        if (book) {
          if (application.status === ApplicationStatus.APPROVED) {
            this.notificationService
              .notifyApplicationApproved(
                application.readerId,
                application.bookId,
                book.title,
                application.id,
              )
              .catch((err: unknown) =>
                this.logger.error(
                  'Failed to send approval notification:',
                  err instanceof Error ? err.stack : err,
                ),
              );
          } else if (application.status === ApplicationStatus.REJECTED) {
            this.notificationService
              .notifyApplicationRejected(
                application.readerId,
                application.bookId,
                book.title,
                application.id,
              )
              .catch((err: unknown) =>
                this.logger.error(
                  'Failed to send rejection notification:',
                  err instanceof Error ? err.stack : err,
                ),
              );
          }
        }
      }
    }

    if (dto.readingStatus !== undefined) {
      if (!isReader) {
        const error =
          ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
        throw new ForbiddenException({
          message: 'Only the applicant can update reading status',
          code: error.code,
        });
      }
      if (application.status !== 'approved') {
        const error =
          ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_APPROVED];
        throw new ForbiddenException({
          message: 'Can only update reading status for approved applications',
          code: error.code,
        });
      }
      application.readingStatus = dto.readingStatus;
      if (
        dto.readingStatus === 'currently_reading' &&
        !application.readingStartedAt
      ) {
        application.readingStartedAt = new Date();
      }
      if (
        dto.readingStatus === 'for_review' &&
        !application.readingCompletedAt
      ) {
        application.readingCompletedAt = new Date();
      }
    }

    if (dto.markCopySent === true) {
      if (!isAuthor) {
        const error = BookErrors[BookErrorCode.AUTHOR_ACCESS_REQUIRED];
        throw new ForbiddenException({
          message: error.message,
          code: error.code,
        });
      }
      if (application.status !== 'approved') {
        const error =
          ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_APPROVED];
        throw new ForbiddenException({
          message: 'Can only mark sent for approved applications',
          code: error.code,
        });
      }
      application.copySentAt = new Date();
    }

    if (dto.markCopyReceived === true) {
      if (!isReader) {
        const error =
          ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
        throw new ForbiddenException({
          message: 'Only the applicant can mark as received',
          code: error.code,
        });
      }
      if (application.status !== 'approved') {
        const error =
          ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_APPROVED];
        throw new ForbiddenException({
          message: 'Can only mark received for approved applications',
          code: error.code,
        });
      }
      application.copyReceivedAt = new Date();
    }

    return await this.applicationRepo.save(application);
  }

  async getBookApplications(
    bookId: string,
    authorId: string,
    userType: UserType | undefined,
    dto: FindBookApplicationsDto,
  ) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (book.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const skip = dto.skip ?? 0;
    const take = dto.take ?? 20;
    const sortBy = dto.sortBy ?? 'application_date';
    const sortOrder = dto.sortOrder ?? 'DESC';

    const query = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.book', 'book')
      .leftJoinAndSelect('book.author', 'author')
      .leftJoinAndSelect('application.reader', 'reader')
      .leftJoin('application.review', 'review')
      .where('application.bookId = :bookId', { bookId });

    switch (sortBy) {
      case 'reader_rating':
        query
          .addSelect(
            `(SELECT COALESCE(AVG(r.rating), 0) FROM reviews r 
             INNER JOIN applications a ON r.application_id = a.id 
             WHERE a.reader_id = application.reader_id)`,
            'readerAvgRating',
          )
          .orderBy(
            `(SELECT COALESCE(AVG(r.rating), 0) FROM reviews r 
             INNER JOIN applications a ON r.application_id = a.id 
             WHERE a.reader_id = application.reader_id)`,
            sortOrder,
          )
          .addOrderBy('application.appliedAt', 'DESC');
        break;
      case 'reading_status':
        query
          .orderBy('application.readingStatus', sortOrder)
          .addOrderBy('application.appliedAt', 'DESC');
        break;
      case 'application_date':
      default:
        query.orderBy('application.appliedAt', sortOrder);
        break;
    }

    const [applications, total] = await query
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const needsPhysicalAddress =
      book.distributionType === 'physical' || book.distributionType === 'both';
    const readerIds = applications.map((app) => app.readerId);
    const readerAddressesMap = new Map<string, UserAddress[]>();

    if (needsPhysicalAddress && readerIds.length > 0) {
      const addresses = await this.userAddressRepo.find({
        where: { userId: In(readerIds) },
        order: { isPrimary: 'DESC', createdAt: 'ASC' },
      });

      addresses.forEach((addr) => {
        const existing = readerAddressesMap.get(addr.userId) || [];
        existing.push(addr);
        readerAddressesMap.set(addr.userId, existing);
      });

      applications.forEach((app) => {
        if (app.reader) {
          const readerAddresses = readerAddressesMap.get(app.readerId) || [];
          (app.reader as any).addresses = readerAddresses;
        }
      });
    }

    return createPaginatedResponse(applications, total, skip, take);
  }

  async updateApplicationStatus(
    applicationId: string,
    authorId: string,
    userType?: string,
    dto?: ApplicationStatusDto,
  ): Promise<Application> {
    ensureAuthor(userType);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['book', 'book.author'],
    });

    if (!application) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (application.book.authorId !== authorId) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOR_AUTHOR_BOOK];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    if (application.status !== 'pending') {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_PENDING];
      throw new ForbiddenException({
        message: 'Can only update pending applications',
        code: error.code,
      });
    }

    application.status = dto?.status ?? ApplicationStatus.APPROVED;
    application.authorNotes = dto?.authorNotes ?? application.authorNotes;
    application.respondedAt = new Date();
    application.respondedById = authorId;

    if (application.status === 'approved') {
      await this.bookRepo.decrement(
        { id: application.bookId },
        'availableCopies',
        1,
      );
      if (application.book.distributionType === 'digital') {
        application.copySentAt = new Date();
      }
    }

    const saved = await this.applicationRepo.save(application);

    if (this.notificationService) {
      const book = await this.bookRepo.findOne({
        where: { id: application.bookId },
      });
      if (book) {
        if (saved.status === 'approved') {
          this.notificationService
            .notifyApplicationApproved(
              application.readerId,
              application.bookId,
              book.title,
              application.id,
            )
            .catch((err: any) =>
              console.error('Failed to send approval notification:', err),
            );
        } else if (saved.status === 'rejected') {
          this.notificationService
            .notifyApplicationRejected(
              application.readerId,
              application.bookId,
              book.title,
              application.id,
            )
            .catch((err: any) =>
              console.error('Failed to send rejection notification:', err),
            );
        }
      }
    }

    return saved;
  }

  async approveApplication(
    applicationId: string,
    authorId: string,
    userType?: string,
    authorNotes?: string,
  ): Promise<Application> {
    return this.updateApplicationStatus(applicationId, authorId, userType, {
      status: ApplicationStatus.APPROVED,
      authorNotes,
    });
  }

  async rejectApplication(
    applicationId: string,
    authorId: string,
    userType?: string,
    authorNotes?: string,
  ): Promise<Application> {
    return this.updateApplicationStatus(applicationId, authorId, userType, {
      status: ApplicationStatus.REJECTED,
      authorNotes,
    });
  }

  async bulkUpdateApplicationStatus(
    bookId: string,
    authorId: string,
    userType?: string,
    dto?: BulkActionDto,
  ): Promise<{ updated: number }> {
    ensureAuthor(userType);

    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (book.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    if (book.selectionMethod === SelectionMethod.LOTTERY) {
      throw new BadRequestException(
        'Cannot manually approve or reject applications for books with lottery selection. Please use the run-lottery endpoint after the application deadline.',
      );
    }

    if (!dto || !dto.applicationIds || dto.applicationIds.length === 0) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    const applications = await this.applicationRepo.find({
      where: {
        id: In(dto.applicationIds),
        bookId,
        status: ApplicationStatus.PENDING,
      },
    });

    if (applications.length !== dto.applicationIds.length) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    const updatedApplications = applications.map((app) => {
      app.status = dto.action;
      app.authorNotes = dto.authorNotes ?? app.authorNotes;
      app.respondedAt = new Date();
      app.respondedById = authorId;
      return app;
    });

    await this.applicationRepo.save(updatedApplications);

    if (dto.action === 'approved') {
      await this.bookRepo.decrement(
        { id: bookId },
        'availableCopies',
        updatedApplications.length,
      );
      const now = new Date();
      updatedApplications.forEach((app) => {
        if (book.distributionType === 'digital') {
          app.copySentAt = now;
        }
      });
      await this.applicationRepo.save(updatedApplications);
    }

    if (this.notificationService) {
      for (const app of updatedApplications) {
        if (app.status === 'approved') {
          this.notificationService
            .notifyApplicationApproved(
              app.readerId,
              app.bookId,
              book.title,
              app.id,
            )
            .catch((err: any) =>
              console.error('Failed to send approval notification:', err),
            );
        } else if (app.status === 'rejected') {
          this.notificationService
            .notifyApplicationRejected(
              app.readerId,
              app.bookId,
              book.title,
              app.id,
            )
            .catch((err: any) =>
              console.error('Failed to send rejection notification:', err),
            );
        }
      }
    }

    return { updated: updatedApplications.length };
  }

  async markCopySent(
    applicationId: string,
    authorId: string,
    userType?: string,
  ): Promise<Application> {
    ensureAuthor(userType);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['book', 'book.author'],
    });

    if (!application) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (application.book.authorId !== authorId) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOR_AUTHOR_BOOK];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    if (application.status !== 'approved') {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_APPROVED];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    application.copySentAt = new Date();
    return await this.applicationRepo.save(application);
  }

  async markCopyReceived(
    applicationId: string,
    readerId: string,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, readerId },
      relations: ['book', 'book.author'],
    });

    if (!application) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (application.status !== 'approved') {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_APPROVED];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    application.copyReceivedAt = new Date();
    return await this.applicationRepo.save(application);
  }

  async updateReadingStatus(
    applicationId: string,
    readerId: string,
    dto: UpdateReadingStatusDto,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, readerId },
      relations: ['book', 'book.author'],
    });

    if (!application) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (application.status !== 'approved') {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_APPROVED];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    application.readingStatus = dto.readingStatus;

    if (
      dto.readingStatus === 'currently_reading' &&
      !application.readingStartedAt
    ) {
      application.readingStartedAt = new Date();
    }

    if (dto.readingStatus === 'for_review') {
      application.readingCompletedAt = new Date();
    }

    const saved = await this.applicationRepo.save(application);

    if (this.userActivityService) {
      try {
        if (
          dto.readingStatus === 'currently_reading' &&
          application.readingStartedAt
        ) {
          await this.userActivityService.logBookStarted(
            readerId,
            application.bookId,
            application.id,
          );
        } else if (
          dto.readingStatus === 'for_review' &&
          application.readingCompletedAt
        ) {
          await this.userActivityService.logBookCompleted(
            readerId,
            application.bookId,
            application.id,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to log reading status activity: ${error}`,
          error?.stack,
        );
      }
    }

    return saved;
  }

  async withdrawApplication(
    applicationId: string,
    readerId: string,
  ): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, readerId },
      relations: ['book', 'book.author'],
    });

    if (!application) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (application.status !== 'pending') {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_CANNOT_WITHDRAW];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    application.status = ApplicationStatus.WITHDRAWN;
    return await this.applicationRepo.save(application);
  }

  async getShippingInfo(
    bookId: string,
    authorId: string,
    userType?: string,
  ): Promise<ShippingApplicationDto[]> {
    ensureAuthor(userType);

    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (book.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    if (
      book.distributionType !== 'physical' &&
      book.distributionType !== 'both'
    ) {
      return [];
    }

    const applications = await this.applicationRepo.find({
      where: { bookId, status: ApplicationStatus.APPROVED },
      relations: ['reader'],
      order: { appliedAt: 'ASC' },
    });

    if (applications.length === 0) {
      return [];
    }

    const readerIds = applications.map((app) => app.readerId);

    const addresses = await this.userAddressRepo.find({
      where: { userId: In(readerIds) },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });

    const addressesMap = new Map<string, UserAddress[]>();
    addresses.forEach((addr) => {
      const existing = addressesMap.get(addr.userId) || [];
      existing.push(addr);
      addressesMap.set(addr.userId, existing);
    });

    return applications.map((app) => {
      const reader = app.reader;
      const readerAddresses = addressesMap.get(app.readerId) || [];

      const primaryAddress =
        readerAddresses.find((addr) => addr.isPrimary) || readerAddresses[0];

      return {
        id: app.id,
        readerId: app.readerId,
        readerFirstName: reader.firstName,
        readerLastName: reader.lastName,
        readerEmail: reader.email,
        applicationMessage: app.applicationMessage,
        authorNotes: app.authorNotes,
        copySentAt: app.copySentAt,
        respondedAt: app.respondedAt,
        appliedAt: app.appliedAt,
        address: primaryAddress
          ? {
              id: primaryAddress.id,
              streetAddress: primaryAddress.streetAddress,
              city: primaryAddress.city,
              postalCode: primaryAddress.postalCode,
              country: primaryAddress.country,
              isPrimary: primaryAddress.isPrimary,
            }
          : null,
      };
    });
  }

  async bulkMarkCopySent(
    bookId: string,
    authorId: string,
    userType: UserType | undefined,
    dto: BulkMarkSentDto,
  ): Promise<{ updated: number }> {
    ensureAuthor(userType);

    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (book.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const applications = await this.applicationRepo.find({
      where: {
        id: In(dto.applicationIds),
        bookId,
        status: ApplicationStatus.APPROVED,
      },
    });

    if (applications.length !== dto.applicationIds.length) {
      const error =
        ApplicationErrors[ApplicationErrorCode.APPLICATION_NOT_FOUND];
      throw new NotFoundException({
        message: 'Some applications not found or not approved',
        code: error.code,
      });
    }

    const now = new Date();
    await this.applicationRepo.update(
      { id: In(dto.applicationIds) },
      { copySentAt: now },
    );

    return { updated: applications.length };
  }

  async getOverdueReviews(authorId: string): Promise<Application[]> {
    const now = new Date();

    const applications = await this.applicationRepo
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.book', 'book')
      .leftJoinAndSelect('application.reader', 'reader')
      .where('book.authorId = :authorId', { authorId })
      .andWhere('application.status = :status', {
        status: ApplicationStatus.APPROVED,
      })
      .andWhere('application.copyReceivedAt IS NOT NULL')
      .andWhere('book.reviewDeadline IS NOT NULL')
      .andWhere('book.reviewDeadline < :now', { now })
      .getMany();

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
    const book = await this.bookRepo.findOne({
      where: { id: bookId },
    });

    if (!book) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (book.authorId !== authorId) {
      const error = BookErrors[BookErrorCode.BOOK_NOT_OWNED_BY_AUTHOR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

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

    const pendingApplications = await this.applicationRepo.find({
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
      };
    }

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

    const shuffled = [...pendingApplications].sort(() => Math.random() - 0.5);

    const availableCopies = book.availableCopies;
    const winners = shuffled.slice(0, availableCopies);
    const losers = shuffled.slice(availableCopies);

    const nowDate = new Date();

    if (winners.length > 0) {
      const updateData: any = {
        status: ApplicationStatus.APPROVED,
        respondedAt: nowDate,
      };
      if (book.distributionType === 'digital') {
        updateData.copySentAt = nowDate;
      }
      await this.applicationRepo.update(
        { id: In(winners.map((w) => w.id)) },
        updateData,
      );

      book.availableCopies -= winners.length;
      await this.bookRepo.save(book);

      if (this.notificationService) {
        for (const winner of winners) {
          try {
            await this.notificationService.notifyApplicationApproved(
              winner.readerId,
              book.id,
              book.title,
              winner.id,
            );
          } catch (error) {
            this.logger.error(
              `Failed to send approval notification to ${winner.readerId}: ${error}`,
              error?.stack,
            );
          }
        }
      }
    }

    if (losers.length > 0) {
      await this.applicationRepo.update(
        { id: In(losers.map((l) => l.id)) },
        {
          status: ApplicationStatus.REJECTED,
          respondedAt: nowDate,
        },
      );

      if (this.notificationService) {
        for (const loser of losers) {
          try {
            await this.notificationService.notifyApplicationRejected(
              loser.readerId,
              book.id,
              book.title,
              loser.id,
            );
          } catch (error) {
            this.logger.error(
              `Failed to send rejection notification to ${loser.readerId}: ${error}`,
              error?.stack,
            );
          }
        }
      }
    }

    return {
      approved: winners.length,
      rejected: losers.length,
      message: `Lottery completed: ${winners.length} approved, ${losers.length} rejected`,
    };
  }

  private isUserEligibleForBook(user: User, book: Book): boolean {
    if (book.ageRating === AgeRating.ALL) {
      return true;
    }

    if (!user.birthDate) {
      return true;
    }

    const birthDate = new Date(user.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    switch (book.ageRating) {
      case AgeRating.THIRTEEN_PLUS:
        return age >= 13;
      case AgeRating.SIXTEEN_PLUS:
        return age >= 16;
      case AgeRating.EIGHTEEN_PLUS:
        return age >= 18;
      default:
        return true;
    }
  }
}
