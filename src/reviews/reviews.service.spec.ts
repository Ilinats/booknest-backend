import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewsService } from './reviews.service';
import { Review } from './entity/review.entity';
import { Application } from '../applications/entity/application.entity';
import { Book } from '../books/entity/book.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReadingStatus, ApplicationStatus } from '../applications/enums';
import { ReviewErrorCode } from './errors';
import { UserType } from '../users/enums';
import { UserActivityService } from '../user-activity/user-activity.service';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepo: MockRepo<Review>;
  let applicationRepo: MockRepo<Application>;
  let bookRepo: MockRepo<Book>;
  let userActivityService: jest.Mocked<UserActivityService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Application),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(Book),
          useValue: createMockRepo(),
        },
        {
          provide: UserActivityService,
          useValue: {
            logReviewPosted: jest.fn(),
            getActivityStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    reviewRepo = module.get(getRepositoryToken(Review));
    applicationRepo = module.get(getRepositoryToken(Application));
    bookRepo = module.get(getRepositoryToken(Book));
    userActivityService = module.get(UserActivityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const baseDto: CreateReviewDto = {
      applicationId: 'app-1',
      rating: 5,
      reviewType: 'text' as any,
      reviewContent: 'Great book',
      isPublic: true,
    };

    it('should throw NotFoundException when application not found', async () => {
      applicationRepo.findOne.mockResolvedValue(null);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when application not approved', async () => {
      const application: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.PENDING,
        bookId: 'book-1',
      } as any;

      applicationRepo.findOne.mockResolvedValue(application);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when review already exists', async () => {
      const application: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        bookId: 'book-1',
      } as any;

      applicationRepo.findOne.mockResolvedValue(application);
      reviewRepo.findOne.mockResolvedValue({ id: 'rev-1' } as Review);

      await expect(service.create('reader-1', baseDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should create review, update application and log activity', async () => {
      const application: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        bookId: 'book-1',
      } as any;

      applicationRepo.findOne.mockResolvedValue(application);
      reviewRepo.findOne.mockResolvedValue(null);

      const review: Review = {
        id: 'rev-1',
        applicationId: 'app-1',
        rating: baseDto.rating,
        reviewType: baseDto.reviewType,
        reviewContent: baseDto.reviewContent,
        isPublic: baseDto.isPublic,
        wordCount: 2,
      } as any;

      reviewRepo.create.mockReturnValue(review);
      reviewRepo.save.mockResolvedValue(review);
      applicationRepo.save.mockResolvedValue(application);

      const result = await service.create('reader-1', baseDto);

      expect(reviewRepo.create).toHaveBeenCalled();
      expect(reviewRepo.save).toHaveBeenCalledWith(review);
      expect(applicationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'app-1',
          readingStatus: ReadingStatus.REVIEWED,
        }),
      );
      expect(userActivityService.logReviewPosted).toHaveBeenCalledWith(
        'reader-1',
        application.bookId,
        application.id,
        baseDto.rating,
      );
      expect(result).toEqual(review);
    });

    it('should create review and still return when logReviewPosted throws', async () => {
      const application: Application = {
        id: 'app-1',
        readerId: 'reader-1',
        status: ApplicationStatus.APPROVED,
        bookId: 'book-1',
      } as any;

      applicationRepo.findOne.mockResolvedValue(application);
      reviewRepo.findOne.mockResolvedValue(null);

      const review: Review = {
        id: 'rev-1',
        applicationId: 'app-1',
        rating: baseDto.rating,
        reviewType: baseDto.reviewType,
        reviewContent: baseDto.reviewContent,
        isPublic: baseDto.isPublic,
        wordCount: 2,
      } as any;

      reviewRepo.create.mockReturnValue(review);
      reviewRepo.save.mockResolvedValue(review);
      applicationRepo.save.mockResolvedValue(application);
      userActivityService.logReviewPosted.mockRejectedValue(
        new Error('Activity service down'),
      );

      const result = await service.create('reader-1', baseDto);

      expect(result).toEqual(review);
      expect(reviewRepo.save).toHaveBeenCalledWith(review);
    });
  });

  describe('findUserReviewForBook', () => {
    it('should return null when no review found', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      const result = await service.findUserReviewForBook('book-1', 'user-1');
      expect(result).toBeNull();
    });

    it('should sanitize book file fields when review has book', async () => {
      const review: Review = {
        id: 'rev-1',
        application: {
          id: 'app-1',
          book: {
            id: 'book-1',
            authorId: 'author-1',
            fileUrl: 'url',
            fileSize: 123,
            fileType: 'pdf',
          } as any,
        } as any,
      } as any;

      reviewRepo.findOne.mockResolvedValue(review);

      const result = await service.findUserReviewForBook('book-1', 'user-1');

      expect(result?.application?.book?.fileUrl).toBeUndefined();
      expect(result?.application?.book?.fileSize).toBeUndefined();
      expect(result?.application?.book?.fileType).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('rev-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when access denied', async () => {
      const review: Review = {
        id: 'rev-1',
        isPublic: false,
        application: {
          readerId: 'other-reader',
          book: { authorId: 'other-author' } as any,
        } as any,
      } as any;

      reviewRepo.findOne.mockResolvedValue(review);

      await expect(service.findOne('rev-1', 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should sanitize book for non-author', async () => {
      const review: Review = {
        id: 'rev-1',
        isPublic: true,
        application: {
          readerId: 'user-1',
          book: {
            id: 'book-1',
            authorId: 'author-1',
            fileUrl: 'url',
            fileSize: 100,
            fileType: 'pdf',
          } as any,
        } as any,
      } as any;

      reviewRepo.findOne.mockResolvedValue(review);

      const result = await service.findOne('rev-1', 'user-1');

      expect(result.application.book.fileUrl).toBeUndefined();
      expect(result.application.book.fileSize).toBeUndefined();
      expect(result.application.book.fileType).toBeUndefined();
    });
  });

  describe('update', () => {
    const baseDto: UpdateReviewDto = {
      rating: 4,
      reviewType: 'text' as any,
      reviewContent: 'Updated review content',
      reviewUrls: [],
      isPublic: false,
    };

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('rev-1', 'user-1', UserType.READER, baseDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when non-reader tries to update review fields', async () => {
      const review: Review = {
        id: 'rev-1',
        application: {
          readerId: 'other-user',
          book: { authorId: 'author-1' } as any,
        } as any,
        wordCount: 10,
        rating: 5,
        reviewType: 'text' as any,
        reviewContent: 'Old',
        reviewUrls: [],
        isPublic: true,
      } as any;

      reviewRepo.findOne.mockResolvedValue(review);

      await expect(
        service.update('rev-1', 'user-1', UserType.READER, baseDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should update review fields and word count when reader updates', async () => {
      const review: Review = {
        id: 'rev-1',
        application: {
          readerId: 'user-1',
          book: { authorId: 'author-1' } as any,
        } as any,
        wordCount: 2,
        rating: 5,
        reviewType: 'text' as any,
        reviewContent: 'Old content',
        reviewUrls: [],
        isPublic: true,
      } as any;

      reviewRepo.findOne.mockResolvedValue(review);
      reviewRepo.save.mockImplementation(async (r) => r);

      const result = await service.update(
        'rev-1',
        'user-1',
        UserType.READER,
        baseDto,
      );

      expect(result.rating).toBe(baseDto.rating);
      expect(result.reviewContent).toBe(baseDto.reviewContent);
      expect(result.isPublic).toBe(false);
      expect(result.wordCount).toBe(
        baseDto.reviewContent?.trim().split(/\s+/).length,
      );
    });

    it('should set wordCount to null when reviewType is link', async () => {
      const review: Review = {
        id: 'rev-1',
        application: {
          readerId: 'user-1',
          book: { authorId: 'author-1' } as any,
        } as any,
        wordCount: 10,
        rating: 5,
        reviewType: 'text' as any,
        reviewContent: 'Old',
        reviewUrls: [],
        isPublic: true,
      } as any;

      reviewRepo.findOne.mockResolvedValue(review);
      reviewRepo.save.mockImplementation(async (r) => r);

      await service.update('rev-1', 'user-1', UserType.READER, {
        ...baseDto,
        reviewType: 'link' as any,
        reviewContent: undefined,
      });

      expect(reviewRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ wordCount: null }),
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('rev-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not review owner', async () => {
      const review: Review = {
        id: 'rev-1',
        application: { id: 'app-1', readerId: 'other-user' } as any,
      } as any;

      reviewRepo.findOne.mockResolvedValue(review);

      await expect(service.remove('rev-1', 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should remove review and reset application status', async () => {
      const application: Application = {
        id: 'app-1',
        readerId: 'user-1',
        readingStatus: ReadingStatus.REVIEWED,
      } as any;

      const review: Review = {
        id: 'rev-1',
        application,
      } as any;

      reviewRepo.findOne.mockResolvedValue(review);
      reviewRepo.remove.mockResolvedValue(review);
      applicationRepo.save.mockResolvedValue(application);

      await service.remove('rev-1', 'user-1');

      expect(reviewRepo.remove).toHaveBeenCalledWith(review);
      expect(applicationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'app-1',
          readingStatus: ReadingStatus.FOR_REVIEW,
        }),
      );
    });
  });

  describe('getBookReviews', () => {
    it('should filter private reviews for non-author by default', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      reviewRepo.createQueryBuilder.mockReturnValue(qbMock);
      bookRepo.findOne.mockResolvedValue(null);

      const dto: FindReviewsDto = { skip: 0, take: 10 };
      const result = await service.getBookReviews(
        'book-1',
        dto,
        'user-1',
        UserType.READER,
      );

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'review.isPublic = :isPublic',
        {
          isPublic: true,
        },
      );
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should not filter by isPublic when caller is author', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'rev-1',
              application: {
                book: {
                  id: 'book-1',
                  authorId: 'author-1',
                  fileUrl: 'url',
                  fileSize: 100,
                  fileType: 'pdf',
                },
              },
            },
          ],
          1,
        ]),
      };

      reviewRepo.createQueryBuilder.mockReturnValue(qbMock);
      bookRepo.findOne.mockResolvedValue({
        id: 'book-1',
        authorId: 'author-1',
      });

      const dto: FindReviewsDto = { skip: 0, take: 10 };
      const result = await service.getBookReviews(
        'book-1',
        dto,
        'author-1',
        UserType.AUTHOR,
      );

      expect(qbMock.andWhere).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should sanitize book file fields for non-author in getBookReviews', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'rev-1',
              application: {
                book: {
                  id: 'book-1',
                  authorId: 'author-1',
                  fileUrl: 'url',
                  fileSize: 100,
                  fileType: 'pdf',
                },
              },
            },
          ],
          1,
        ]),
      };

      reviewRepo.createQueryBuilder.mockReturnValue(qbMock);
      bookRepo.findOne.mockResolvedValue(null);

      const dto: FindReviewsDto = { skip: 0, take: 10, includePrivate: true };
      const result = await service.getBookReviews(
        'book-1',
        dto,
        'reader-1',
        UserType.READER,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].application?.book?.fileUrl).toBeUndefined();
      expect(result.data[0].application?.book?.fileSize).toBeUndefined();
      expect(result.data[0].application?.book?.fileType).toBeUndefined();
    });
  });

  describe('getUserReviews', () => {
    it('should filter by isPublic when includePrivate is false', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      reviewRepo.createQueryBuilder.mockReturnValue(qbMock);

      const dto: FindReviewsDto = { skip: 0, take: 10, includePrivate: false };
      const result = await service.getUserReviews('user-1', dto);

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'review.isPublic = :isPublic',
        {
          isPublic: true,
        },
      );
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should sanitize book file fields in returned reviews', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'rev-1',
              application: {
                book: {
                  id: 'book-1',
                  fileUrl: 'url',
                  fileSize: 100,
                  fileType: 'pdf',
                },
              },
            },
          ],
          1,
        ]),
      };

      reviewRepo.createQueryBuilder.mockReturnValue(qbMock);

      const dto: FindReviewsDto = { skip: 0, take: 10 };
      const result = await service.getUserReviews('user-1', dto);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].application?.book?.fileUrl).toBeUndefined();
      expect(result.data[0].application?.book?.fileSize).toBeUndefined();
      expect(result.data[0].application?.book?.fileType).toBeUndefined();
    });
  });

  describe('getAuthorLatestReviews', () => {
    it('should call query builder with correct params', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      reviewRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getAuthorLatestReviews('author-1', 3);

      expect(reviewRepo.createQueryBuilder).toHaveBeenCalledWith('review');
      expect(qbMock.where).toHaveBeenCalledWith('book.authorId = :authorId', {
        authorId: 'author-1',
      });
      expect(qbMock.take).toHaveBeenCalledWith(3);
      expect(result).toEqual([]);
    });
  });
});
