import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserActivity, ActivityType } from './entity/user-activity.entity';
import { User } from './entity/user.entity';
import { Book } from '../books/entity/book.entity';
import { Application } from '../applications/entity/application.entity';

@Injectable()
export class UserActivityService {
  constructor(
    @InjectRepository(UserActivity)
    private readonly userActivityRepository: Repository<UserActivity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createActivity(
    userId: string,
    activityType: ActivityType,
    metadata?: Record<string, any>,
    bookId?: string,
    applicationId?: string
  ): Promise<UserActivity> {
    const activity = this.userActivityRepository.create({
      userId,
      activityType,
      metadata,
      bookId,
      applicationId
    });

    return this.userActivityRepository.save(activity);
  }

  async getUserActivity(userId: string, limit: number = 20): Promise<UserActivity[]> {
    return this.userActivityRepository.find({
      where: { userId },
      relations: ['book', 'application'],
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  async getFriendsActivity(userId: string, friendIds: string[], limit: number = 50): Promise<UserActivity[]> {
    if (friendIds.length === 0) {
      return [];
    }

    return this.userActivityRepository.find({
      where: { userId: In(friendIds) },
      relations: ['user', 'book', 'application'],
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  async getPublicActivity(userId: string, limit: number = 20): Promise<UserActivity[]> {
    return this.userActivityRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.book', 'book')
      .leftJoinAndSelect('activity.application', 'application')
      .where('activity.userId = :userId', { userId })
      .andWhere('activity.activityType IN (:...publicTypes)', {
        publicTypes: ['book_published', 'review_posted']
      })
      .orderBy('activity.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getActivityByType(
    userId: string, 
    activityType: ActivityType, 
    limit: number = 20
  ): Promise<UserActivity[]> {
    return this.userActivityRepository.find({
      where: { userId, activityType },
      relations: ['book', 'application'],
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  async getRecentActivity(userId: string, days: number = 7, limit: number = 50): Promise<UserActivity[]> {
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

  async getActivityStats(userId: string): Promise<{
    totalActivities: number;
    activitiesByType: Record<ActivityType, number>;
    lastActivity?: Date;
  }> {
    const [totalActivities, activitiesByType, lastActivity] = await Promise.all([
      this.userActivityRepository.count({ where: { userId } }),
      this.getActivitiesByType(userId),
      this.getLastActivity(userId)
    ]);

    return {
      totalActivities,
      activitiesByType,
      lastActivity
    };
  }

  private async getActivitiesByType(userId: string): Promise<Record<ActivityType, number>> {
    const activities = await this.userActivityRepository
      .createQueryBuilder('activity')
      .select('activity.activityType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('activity.userId = :userId', { userId })
      .groupBy('activity.activityType')
      .getRawMany();

    const result: Record<ActivityType, number> = {
      book_applied: 0,
      book_approved: 0,
      book_rejected: 0,
      review_posted: 0,
      book_started: 0,
      book_completed: 0,
      book_published: 0,
      profile_updated: 0
    };

    activities.forEach(activity => {
      result[activity.type as ActivityType] = parseInt(activity.count);
    });

    return result;
  }

  private async getLastActivity(userId: string): Promise<Date | undefined> {
    const lastActivity = await this.userActivityRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    return lastActivity?.createdAt;
  }

  async logBookApplied(userId: string, bookId: string, applicationId: string): Promise<UserActivity> {
    return this.createActivity(userId, 'book_applied', { bookId }, bookId, applicationId);
  }

  async logBookApproved(userId: string, bookId: string, applicationId: string): Promise<UserActivity> {
    return this.createActivity(userId, 'book_approved', { bookId }, bookId, applicationId);
  }

  async logBookRejected(userId: string, bookId: string, applicationId: string): Promise<UserActivity> {
    return this.createActivity(userId, 'book_rejected', { bookId }, bookId, applicationId);
  }

  async logReviewPosted(userId: string, bookId: string, applicationId: string, rating: number): Promise<UserActivity> {
    return this.createActivity(userId, 'review_posted', { bookId, rating }, bookId, applicationId);
  }

  async logBookStarted(userId: string, bookId: string, applicationId: string): Promise<UserActivity> {
    return this.createActivity(userId, 'book_started', { bookId }, bookId, applicationId);
  }

  async logBookCompleted(userId: string, bookId: string, applicationId: string): Promise<UserActivity> {
    return this.createActivity(userId, 'book_completed', { bookId }, bookId, applicationId);
  }

  async logBookPublished(userId: string, bookId: string): Promise<UserActivity> {
    return this.createActivity(userId, 'book_published', { bookId }, bookId);
  }

  async logProfileUpdated(userId: string, changes: string[]): Promise<UserActivity> {
    return this.createActivity(userId, 'profile_updated', { changes });
  }
}
