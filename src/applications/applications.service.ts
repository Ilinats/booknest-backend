import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entity/application.entity';
import { Book } from '../books/entity/book.entity';
import { User } from '../users/entity/user.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationStatusDto } from './dto/application-status.dto';
import { BulkActionDto } from './dto/bulk-action.dto';
import { UpdateReadingStatusDto } from './dto/update-reading-status.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private ensureAuthor(userType?: string) {
    if (userType !== 'author') {
      throw new ForbiddenException('Author access required');
    }
  }

  async create(readerId: string, dto: CreateApplicationDto) {
    const user = await this.userRepo.findOne({ where: { id: readerId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Email verification required to apply for books. Please verify your email address first.');
    }

    const book = await this.bookRepo.findOne({ where: { id: dto.bookId } });
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    if (book.status !== 'active') {
      throw new ForbiddenException('Cannot apply for inactive books');
    }

    const existingApplication = await this.applicationRepo.findOne({
      where: { bookId: dto.bookId, readerId }
    });
    if (existingApplication) {
      throw new ConflictException('You have already applied for this book');
    }

    if (book.availableCopies <= 0) {
      throw new ForbiddenException('No available copies for this book');
    }

    const application = this.applicationRepo.create({
      bookId: dto.bookId,
      readerId,
      applicationMessage: dto.applicationMessage ?? null,
    });

    return this.applicationRepo.save(application);
  }

  async findMyApplications(readerId: string) {
    return this.applicationRepo.find({
      where: { readerId },
      relations: ['book', 'book.author'],
      order: { appliedAt: 'DESC' }
    });
  }

  async checkApplication(readerId: string, bookId: string) {
    const application = await this.applicationRepo.findOne({
      where: { readerId, bookId },
      relations: ['book']
    });

    if (!application) {
      return {
        hasApplied: false,
        application: null
      };
    }

    return {
      hasApplied: true,
      application: {
        id: application.id,
        status: application.status,
        appliedAt: application.appliedAt,
        applicationMessage: application.applicationMessage,
        authorNotes: application.authorNotes,
        respondedAt: application.respondedAt,
        book: {
          id: application.book.id,
          title: application.book.title,
          authorId: application.book.authorId
        }
      }
    };
  }

  async findOne(applicationId: string, userId: string, userType?: string) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['book', 'book.author', 'reader']
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.readerId !== userId && application.book.authorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return application;
  }

  async update(applicationId: string, readerId: string, dto: UpdateApplicationDto) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, readerId }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'pending') {
      throw new ForbiddenException('Cannot update non-pending applications');
    }

    application.applicationMessage = dto.applicationMessage ?? application.applicationMessage;
    return this.applicationRepo.save(application);
  }

  async withdraw(applicationId: string, readerId: string) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, readerId }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'pending') {
      throw new ForbiddenException('Cannot withdraw non-pending applications');
    }

    application.status = 'withdrawn';
    return this.applicationRepo.save(application);
  }

  async getBookApplications(bookId: string, authorId: string, userType?: string) {
    this.ensureAuthor(userType);

    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book || book.authorId !== authorId) {
      throw new ForbiddenException('Book not found or not owned by author');
    }

    return this.applicationRepo.find({
      where: { bookId },
      relations: ['reader'],
      order: { appliedAt: 'DESC' }
    });
  }

  async updateApplicationStatus(applicationId: string, authorId: string, userType?: string, dto?: ApplicationStatusDto) {
    this.ensureAuthor(userType);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['book']
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.book.authorId !== authorId) {
      throw new ForbiddenException('Cannot manage applications for other authors\' books');
    }

    if (application.status !== 'pending') {
      throw new ForbiddenException('Can only update pending applications');
    }

    application.status = dto?.status ?? 'approved';
    application.authorNotes = dto?.authorNotes ?? application.authorNotes;
    application.respondedAt = new Date();
    application.respondedById = authorId;

    if (application.status === 'approved') {
      await this.bookRepo.decrement({ id: application.bookId }, 'availableCopies', 1);
    }

    return this.applicationRepo.save(application);
  }

  async bulkAction(authorId: string, userType?: string, dto?: BulkActionDto) {
    this.ensureAuthor(userType);

    const applications = await this.applicationRepo.find({
      where: { id: dto?.applicationIds ? { $in: dto.applicationIds } as any : {} },
      relations: ['book']
    });

    const invalidApplications = applications.filter(app => app.book.authorId !== authorId);
    if (invalidApplications.length > 0) {
      throw new ForbiddenException('Some applications do not belong to your books');
    }

    const updatePromises = applications.map(app => {
      if (app.status === 'pending') {
        app.status = dto?.action ?? 'approved';
        app.authorNotes = dto?.authorNotes ?? app.authorNotes;
        app.respondedAt = new Date();
        app.respondedById = authorId;
        return this.applicationRepo.save(app);
      }
      return Promise.resolve(app);
    });

    const updatedApplications = await Promise.all(updatePromises);

    if (dto?.action === 'approved') {
      const bookUpdates = new Map<string, number>();
      updatedApplications.forEach(app => {
        if (app.status === 'approved') {
          const count = bookUpdates.get(app.bookId) || 0;
          bookUpdates.set(app.bookId, count + 1);
        }
      });

      for (const [bookId, count] of bookUpdates) {
        await this.bookRepo.decrement({ id: bookId }, 'availableCopies', count);
      }
    }

    return { updated: updatedApplications.length };
  }

  async markCopySent(applicationId: string, authorId: string, userType?: string) {
    this.ensureAuthor(userType);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['book']
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.book.authorId !== authorId) {
      throw new ForbiddenException('Cannot manage applications for other authors\' books');
    }

    if (application.status !== 'approved') {
      throw new ForbiddenException('Can only mark copies as sent for approved applications');
    }

    application.copySentAt = new Date();
    return this.applicationRepo.save(application);
  }

  async markCopyReceived(applicationId: string, readerId: string) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, readerId }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'approved') {
      throw new ForbiddenException('Can only mark copies as received for approved applications');
    }

    application.copyReceivedAt = new Date();
    return this.applicationRepo.save(application);
  }

  async updateReadingStatus(applicationId: string, readerId: string, dto: UpdateReadingStatusDto) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, readerId }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'approved') {
      throw new ForbiddenException('Can only update reading status for approved applications');
    }

    const oldStatus = application.readingStatus;
    application.readingStatus = dto.readingStatus;

    if (oldStatus === 'not_started' && dto.readingStatus === 'currently_reading') {
      application.readingStartedAt = new Date();
    } else if (dto.readingStatus === 'for_review' && !application.readingCompletedAt) {
      application.readingCompletedAt = new Date();
    }

    return this.applicationRepo.save(application);
  }

  async getMyReadingProgress(readerId: string) {
    const applications = await this.applicationRepo.find({
      where: { readerId, status: 'approved' },
      relations: ['book', 'book.author'],
      order: { appliedAt: 'DESC' }
    });

    const grouped = {
      not_started: applications.filter(app => app.readingStatus === 'not_started'),
      currently_reading: applications.filter(app => app.readingStatus === 'currently_reading'),
      for_review: applications.filter(app => app.readingStatus === 'for_review'),
      reviewed: applications.filter(app => app.readingStatus === 'reviewed')
    };

    return {
      total: applications.length,
      byStatus: grouped,
      all: applications
    };
  }
}
