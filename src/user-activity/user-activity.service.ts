import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  UserActivity,
  UserActivityMetadata,
} from './entity/user-activity.entity';
import { ActivityType } from './enums';
import { User } from '../users/entity';
import { UserProfileService } from '../user-profile/user-profile.service';
import { UserType } from '../users/enums';

@Injectable()
export class UserActivityService {
  constructor(
    @InjectRepository(UserActivity)
    private readonly userActivityRepository: Repository<UserActivity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userProfileService: UserProfileService,
  ) {}

  async createActivity(
    userId: string,
    activityType: ActivityType,
    metadata?: UserActivityMetadata,
    bookId?: string,
    applicationId?: string,
  ): Promise<UserActivity> {
    const activity = this.userActivityRepository.create({
      userId,
      activityType,
      metadata,
      bookId,
      applicationId,
    });

    return this.userActivityRepository.save(activity);
  }

  async getUserActivity(
    userId: string,
    limit: number = 20,
  ): Promise<UserActivity[]> {
    return this.userActivityRepository.find({
      where: { userId },
      relations: ['book', 'application'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getFriendsActivity(
    userId: string,
    friendIds: string[],
    limit: number = 50,
    userType?: UserType,
  ): Promise<UserActivity[]> {
    if (friendIds.length === 0) {
      return [];
    }

    const allActivities = await this.userActivityRepository.find({
      where: { userId: In(friendIds) },
      relations: ['user', 'book', 'application', 'application.book'],
      order: { createdAt: 'DESC' },
      take: limit * 2,
    });

    const filteredActivities: UserActivity[] = [];
    for (const activity of allActivities) {
      if (!activity.user) {
        continue;
      }

      const activityUserId = activity.userId;

      const canView = await this.userProfileService.canViewActivity(
        userId,
        activityUserId,
      );

      if (canView.canView) {
        filteredActivities.push(
          this.sanitizeActivityBooksForUser(activity, userId, userType),
        );

        if (filteredActivities.length >= limit) {
          break;
        }
      }
    }

    return filteredActivities;
  }

  async getPublicActivity(
    userId: string,
    limit: number = 20,
  ): Promise<UserActivity[]> {
    return this.userActivityRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.book', 'book')
      .leftJoinAndSelect('activity.application', 'application')
      .where('activity.userId = :userId', { userId })
      .andWhere('activity.activityType IN (:...publicTypes)', {
        publicTypes: ['book_published', 'review_posted'],
      })
      .orderBy('activity.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getActivityByType(
    userId: string,
    activityType: ActivityType,
    limit: number = 20,
  ): Promise<UserActivity[]> {
    return this.userActivityRepository.find({
      where: { userId, activityType },
      relations: ['book', 'application'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentActivity(
    userId: string,
    days: number = 7,
    limit: number = 50,
  ): Promise<UserActivity[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.userActivityRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.book', 'book')
      .leftJoinAndSelect('activity.application', 'application')
      .where('activity.userId = :userId', { userId })
      .andWhere('activity.createdAt >= :startDate', { startDate })
      .orderBy('activity.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getRecentPublicActivity(
    userId: string,
    days: number = 7,
    limit: number = 50,
  ): Promise<UserActivity[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.userActivityRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.book', 'book')
      .leftJoinAndSelect('activity.application', 'application')
      .where('activity.userId = :userId', { userId })
      .andWhere('activity.createdAt >= :startDate', { startDate })
      .andWhere('activity.activityType IN (:...publicTypes)', {
        publicTypes: ['book_published', 'review_posted'],
      })
      .orderBy('activity.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getActivityStats(userId: string): Promise<{
    totalActivities: number;
    activitiesByType: Record<ActivityType, number>;
    lastActivity?: Date;
  }> {
    const [totalActivities, activitiesByType, lastActivity] = await Promise.all(
      [
        this.userActivityRepository.count({ where: { userId } }),
        this.getActivitiesByType(userId),
        this.getLastActivity(userId),
      ],
    );

    return {
      totalActivities,
      activitiesByType,
      lastActivity,
    };
  }

  private async getActivitiesByType(
    userId: string,
  ): Promise<Record<ActivityType, number>> {
    const activities = await this.userActivityRepository
      .createQueryBuilder('activity')
      .select('activity.activityType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('activity.userId = :userId', { userId })
      .groupBy('activity.activityType')
      .getRawMany();

    const result = this.createEmptyActivityTypeCounts();

    activities.forEach((activity) => {
      result[activity.type as ActivityType] = parseInt(activity.count, 10);
    });

    return result;
  }

  private async getLastActivity(userId: string): Promise<Date | undefined> {
    const lastActivity = await this.userActivityRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return lastActivity?.createdAt;
  }

  async logBookApplied(
    userId: string,
    bookId: string,
    applicationId: string,
  ): Promise<UserActivity> {
    return this.createActivity(
      userId,
      ActivityType.BOOK_APPLIED,
      { bookId },
      bookId,
      applicationId,
    );
  }

  async logBookApproved(
    userId: string,
    bookId: string,
    applicationId: string,
  ): Promise<UserActivity> {
    return this.createActivity(
      userId,
      ActivityType.BOOK_APPROVED,
      { bookId },
      bookId,
      applicationId,
    );
  }

  async logBookRejected(
    userId: string,
    bookId: string,
    applicationId: string,
  ): Promise<UserActivity> {
    return this.createActivity(
      userId,
      ActivityType.BOOK_REJECTED,
      { bookId },
      bookId,
      applicationId,
    );
  }

  async logReviewPosted(
    userId: string,
    bookId: string,
    applicationId: string,
    rating: number,
  ): Promise<UserActivity> {
    return this.createActivity(
      userId,
      ActivityType.REVIEW_POSTED,
      { bookId, rating },
      bookId,
      applicationId,
    );
  }

  async logBookStarted(
    userId: string,
    bookId: string,
    applicationId: string,
  ): Promise<UserActivity> {
    return this.createActivity(
      userId,
      ActivityType.BOOK_STARTED,
      { bookId },
      bookId,
      applicationId,
    );
  }

  async logBookCompleted(
    userId: string,
    bookId: string,
    applicationId: string,
  ): Promise<UserActivity> {
    return this.createActivity(
      userId,
      ActivityType.BOOK_COMPLETED,
      { bookId },
      bookId,
      applicationId,
    );
  }

  async logBookPublished(
    userId: string,
    bookId: string,
  ): Promise<UserActivity> {
    return this.createActivity(
      userId,
      ActivityType.BOOK_PUBLISHED,
      { bookId },
      bookId,
    );
  }

  async logProfileUpdated(
    userId: string,
    changes: string[],
  ): Promise<UserActivity> {
    return this.createActivity(userId, ActivityType.PROFILE_UPDATED, {
      changes,
    });
  }

  private sanitizeBookFiles<T extends { fileUrl?: unknown; fileSize?: unknown; fileType?: unknown }>(
    book: T,
  ): Omit<T, 'fileUrl' | 'fileSize' | 'fileType'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fileUrl, fileSize, fileType, ...safeBook } = book;
    return safeBook;
  }

  private sanitizeActivityBooksForUser(
    activity: UserActivity,
    viewerId: string,
    viewerType?: UserType,
  ): UserActivity {
    const isAuthorViewer = viewerType === UserType.AUTHOR;

    if (activity.book) {
      const isAuthorOfBook = isAuthorViewer && activity.book.authorId === viewerId;
      if (!isAuthorOfBook) {
        activity.book = this.sanitizeBookFiles(activity.book) as any;
      }
    }

    if (activity.application?.book) {
      const isAuthorOfApplicationBook =
        isAuthorViewer && activity.application.book.authorId === viewerId;
      if (!isAuthorOfApplicationBook) {
        activity.application.book = this.sanitizeBookFiles(
          activity.application.book,
        ) as any;
      }
    }

    return activity;
  }

  private createEmptyActivityTypeCounts(): Record<ActivityType, number> {
    return {
      [ActivityType.BOOK_APPLIED]: 0,
      [ActivityType.BOOK_APPROVED]: 0,
      [ActivityType.BOOK_REJECTED]: 0,
      [ActivityType.REVIEW_POSTED]: 0,
      [ActivityType.BOOK_STARTED]: 0,
      [ActivityType.BOOK_COMPLETED]: 0,
      [ActivityType.BOOK_PUBLISHED]: 0,
      [ActivityType.PROFILE_UPDATED]: 0,
    };
  }
}
