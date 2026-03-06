import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Friend } from './entity/friend.entity';
import { FriendStatus } from './enums';
import { User } from '../users/entity/user.entity';
import { FriendErrorCode } from './errors';
import { sanitizeUserPublic } from '../common/utils/user-sanitizer.util';
import { UserActivityService } from '../user-activity/user-activity.service';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional()
    @Inject('NotificationService')
    private readonly notificationService?: any,
    @Optional()
    @Inject(UserActivityService)
    private readonly userActivityService?: UserActivityService,
  ) {}

  async sendFriendRequest(
    requesterId: string,
    addresseeUsername: string,
    requesterUserType?: string,
  ): Promise<Friend> {
    if (requesterId === addresseeUsername) {
      throw new BadRequestException(FriendErrorCode.CANNOT_FRIEND_SELF);
    }

    if (requesterUserType === 'author') {
      throw new BadRequestException(FriendErrorCode.AUTHORS_CANNOT_FRIEND);
    }

    const addressee = await this.userRepository.findOne({
      where: { username: addresseeUsername },
    });

    if (!addressee) {
      throw new NotFoundException(FriendErrorCode.USER_NOT_FOUND);
    }

    const existingFriendship = await this.friendRepository.findOne({
      where: [
        { requesterId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: requesterId },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        throw new ConflictException(FriendErrorCode.ALREADY_FRIENDS);
      } else if (existingFriendship.status === 'pending') {
        throw new ConflictException(FriendErrorCode.REQUEST_ALREADY_PENDING);
      }
    }

    const friendRequest = this.friendRepository.create({
      requesterId,
      addresseeId: addressee.id,
      status: FriendStatus.PENDING,
    });

    const saved = await this.friendRepository.save(friendRequest);

    if (this.notificationService) {
      const requester = await this.userRepository.findOne({
        where: { id: requesterId },
      });
      const requesterName = requester
        ? `${requester.firstName} ${requester.lastName}`
        : 'Someone';
      this.notificationService
        .notifyFriendRequestReceived(addressee.id, requesterId, requesterName)
        .then((notification) => {
          if (notification) {
            console.log(
              `Friend request notification created for user ${addressee.id}`,
            );
          } else {
            console.log(
              `Friend request notification skipped for user ${addressee.id} (likely due to preferences)`,
            );
          }
        })
        .catch((err: any) => {
          console.error('Failed to send friend request notification:', err);
          console.error('Error stack:', err?.stack);
        });
    } else {
      console.warn('NotificationService not available in FriendsService');
    }

    return saved;
  }

  async acceptFriendRequest(
    userId: string,
    requesterId: string,
  ): Promise<Friend> {
    const friendRequest = await this.friendRepository.findOne({
      where: { requesterId, addresseeId: userId, status: FriendStatus.PENDING },
    });

    if (!friendRequest) {
      throw new NotFoundException(FriendErrorCode.REQUEST_NOT_FOUND);
    }

    friendRequest.status = FriendStatus.ACCEPTED;
    const saved = await this.friendRepository.save(friendRequest);

    if (this.notificationService) {
      const accepter = await this.userRepository.findOne({
        where: { id: userId },
      });
      const requester = await this.userRepository.findOne({
        where: { id: requesterId },
      });
      const accepterName = accepter
        ? `${accepter.firstName} ${accepter.lastName}`
        : 'Someone';
      const requesterName = requester
        ? `${requester.firstName} ${requester.lastName}`
        : 'Someone';

      this.notificationService
        .notifyFriendRequestAccepted(requesterId, userId, accepterName)
        .then((notification) => {
          if (notification) {
            console.log(
              `Friend request accepted notification created for requester ${requesterId}`,
            );
          } else {
            console.log(
              `Friend request accepted notification skipped for requester ${requesterId} (likely due to preferences)`,
            );
          }
        })
        .catch((err: any) => {
          console.error(
            'Failed to send friend accepted notification to requester:',
            err,
          );
          console.error('Error stack:', err?.stack);
        });

      this.notificationService
        .notifyYouAcceptedFriendRequest(userId, requesterId, requesterName)
        .then((notification) => {
          if (notification) {
            console.log(
              `You accepted friend request notification created for accepter ${userId}`,
            );
          } else {
            console.log(
              `You accepted friend request notification skipped for accepter ${userId} (likely due to preferences)`,
            );
          }
        })
        .catch((err: any) => {
          console.error(
            'Failed to send you accepted notification to accepter:',
            err,
          );
          console.error('Error stack:', err?.stack);
        });
    }

    return saved;
  }

  async declineFriendRequest(
    userId: string,
    requesterId: string,
  ): Promise<void> {
    const friendRequest = await this.friendRepository.findOne({
      where: { requesterId, addresseeId: userId, status: FriendStatus.PENDING },
    });

    if (!friendRequest) {
      throw new NotFoundException(FriendErrorCode.REQUEST_NOT_FOUND);
    }

    await this.friendRepository.remove(friendRequest);

    if (this.notificationService) {
      const decliner = await this.userRepository.findOne({
        where: { id: userId },
      });
      const requester = await this.userRepository.findOne({
        where: { id: requesterId },
      });
      const declinerName = decliner
        ? `${decliner.firstName} ${decliner.lastName}`
        : 'Someone';
      const requesterName = requester
        ? `${requester.firstName} ${requester.lastName}`
        : 'Someone';

      this.notificationService
        .notifyFriendRequestDeclined(requesterId, userId, declinerName)
        .then((notification) => {
          if (notification) {
            console.log(
              `Friend request declined notification created for requester ${requesterId}`,
            );
          } else {
            console.log(
              `Friend request declined notification skipped for requester ${requesterId} (likely due to preferences)`,
            );
          }
        })
        .catch((err: any) => {
          console.error(
            'Failed to send friend declined notification to requester:',
            err,
          );
          console.error('Error stack:', err?.stack);
        });

      this.notificationService
        .notifyYouDeclinedFriendRequest(userId, requesterId, requesterName)
        .then((notification) => {
          if (notification) {
            console.log(
              `You declined friend request notification created for decliner ${userId}`,
            );
          } else {
            console.log(
              `You declined friend request notification skipped for decliner ${userId} (likely due to preferences)`,
            );
          }
        })
        .catch((err: any) => {
          console.error(
            'Failed to send you declined notification to decliner:',
            err,
          );
          console.error('Error stack:', err?.stack);
        });
    }
  }

  async unfriend(userId: string, friendId: string): Promise<void> {
    const friendship = await this.friendRepository.findOne({
      where: [
        {
          requesterId: userId,
          addresseeId: friendId,
          status: FriendStatus.ACCEPTED,
        },
        {
          requesterId: friendId,
          addresseeId: userId,
          status: FriendStatus.ACCEPTED,
        },
      ],
    });

    if (!friendship) {
      throw new NotFoundException(FriendErrorCode.FRIENDSHIP_NOT_FOUND);
    }

    await this.friendRepository.remove(friendship);
  }

  async getFriends(
    userId: string,
    status: FriendStatus = FriendStatus.ACCEPTED,
  ): Promise<Friend[]> {
    return this.friendRepository.find({
      where: [
        { requesterId: userId, status },
        { addresseeId: userId, status },
      ],
      relations: ['requester', 'addressee'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFriendRequests(
    userId: string,
    type: 'sent' | 'received' = 'received',
  ): Promise<Friend[]> {
    const where: FindOptionsWhere<Friend> = { status: FriendStatus.PENDING };

    if (type === 'sent') {
      where.requesterId = userId;
    } else {
      where.addresseeId = userId;
    }

    return this.friendRepository.find({
      where,
      relations: ['requester', 'addressee'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFriendshipStatus(
    userId: string,
    targetUserId: string,
  ): Promise<{
    status: FriendStatus | null;
    isRequester: boolean;
  }> {
    const friendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: userId },
      ],
    });

    if (!friendship) {
      return { status: null, isRequester: false };
    }

    return {
      status: friendship.status,
      isRequester: friendship.requesterId === userId,
    };
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.friendRepository.find({
      where: [
        { requesterId: userId, status: FriendStatus.ACCEPTED },
        { addresseeId: userId, status: FriendStatus.ACCEPTED },
      ],
    });

    return friendships.map((friendship) =>
      friendship.requesterId === userId
        ? friendship.addresseeId
        : friendship.requesterId,
    );
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.friendRepository.findOne({
      where: [
        {
          requesterId: userId1,
          addresseeId: userId2,
          status: FriendStatus.ACCEPTED,
        },
        {
          requesterId: userId2,
          addresseeId: userId1,
          status: FriendStatus.ACCEPTED,
        },
      ],
    });

    return !!friendship;
  }

  async getFriendsList(
    userId: string,
    sortBy?: 'alphabetical' | 'recently_added' | 'most_active',
  ): Promise<ReturnType<typeof sanitizeUserPublic>[]> {
    const friendships = await this.friendRepository.find({
      where: [
        { requesterId: userId, status: FriendStatus.ACCEPTED },
        { addresseeId: userId, status: FriendStatus.ACCEPTED },
      ],
      relations: ['requester', 'addressee'],
      order: { createdAt: 'DESC' },
    });

    let friends = friendships.map((friendship) => {
      const friend =
        friendship.requesterId === userId
          ? friendship.addressee
          : friendship.requester;
      return {
        user: sanitizeUserPublic(friend!),
        friendshipCreatedAt: friendship.createdAt,
      };
    });

    if (sortBy === 'alphabetical') {
      friends = friends.sort((a, b) => {
        const nameA = `${a.user.firstName} ${a.user.lastName}`.toLowerCase();
        const nameB = `${b.user.firstName} ${b.user.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === 'recently_added') {
      console.warn(
        'Sorting by recently_added is currently the default order, so this option has no effect',
      );
    } else if (sortBy === 'most_active') {
      if (this.userActivityService) {
        const friendIds = friends.map((f) => f.user.id);
        const lastActivities = await Promise.all(
          friendIds.map(async (friendId) => {
            const stats =
              await this.userActivityService!.getActivityStats(friendId);
            return {
              userId: friendId,
              lastActivity: stats.lastActivity,
              totalActivities: stats.totalActivities,
            };
          }),
        );

        const activityMap = new Map(lastActivities.map((a) => [a.userId, a]));

        friends = friends.sort((a, b) => {
          const activityA = activityMap.get(a.user.id);
          const activityB = activityMap.get(b.user.id);

          if (activityA?.lastActivity && activityB?.lastActivity) {
            return (
              activityB.lastActivity.getTime() -
              activityA.lastActivity.getTime()
            );
          }
          if (activityA?.lastActivity) return -1;
          if (activityB?.lastActivity) return 1;

          const totalA = activityA?.totalActivities || 0;
          const totalB = activityB?.totalActivities || 0;
          return totalB - totalA;
        });
      }
    }

    return friends.map((f) => f.user);
  }

  async getSentRequestsList(
    userId: string,
  ): Promise<ReturnType<typeof sanitizeUserPublic>[]> {
    const friendships = await this.friendRepository.find({
      where: {
        requesterId: userId,
        status: FriendStatus.PENDING,
      },
      relations: ['addressee'],
      order: { createdAt: 'DESC' },
    });

    return friendships.map((friendship) =>
      sanitizeUserPublic(friendship.addressee!),
    );
  }

  async getReceivedRequestsList(
    userId: string,
  ): Promise<ReturnType<typeof sanitizeUserPublic>[]> {
    const friendships = await this.friendRepository.find({
      where: {
        addresseeId: userId,
        status: FriendStatus.PENDING,
      },
      relations: ['requester'],
      order: { createdAt: 'DESC' },
    });

    return friendships.map((friendship) =>
      sanitizeUserPublic(friendship.requester!),
    );
  }

  async searchUsersForFriends(
    userId: string,
    query: string,
    limit: number = 20,
  ): Promise<
    Array<{
      user: ReturnType<typeof sanitizeUserPublic>;
      friendshipStatus: FriendStatus | null;
      isRequester: boolean;
    }>
  > {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;

    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id != :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .andWhere(
        "(user.username ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR CONCAT(user.firstName, ' ', user.lastName) ILIKE :search)",
        { search: searchTerm },
      )
      .limit(limit)
      .getMany();

    if (users.length === 0) {
      return [];
    }

    const userIds = users.map((u) => u.id);

    const friendships = await this.friendRepository
      .createQueryBuilder('friend')
      .where(
        '(friend.requesterId = :userId AND friend.addresseeId IN (:...userIds)) OR (friend.addresseeId = :userId AND friend.requesterId IN (:...userIds))',
        { userId, userIds },
      )
      .getMany();

    const friendshipMap = new Map<
      string,
      { status: FriendStatus; isRequester: boolean }
    >();
    friendships.forEach((friendship) => {
      const otherUserId =
        friendship.requesterId === userId
          ? friendship.addresseeId
          : friendship.requesterId;
      friendshipMap.set(otherUserId, {
        status: friendship.status,
        isRequester: friendship.requesterId === userId,
      });
    });

    return users.map((user) => {
      const friendship = friendshipMap.get(user.id);
      return {
        user: sanitizeUserPublic(user),
        friendshipStatus: friendship?.status || null,
        isRequester: friendship?.isRequester || false,
      };
    });
  }

  async cancelFriendRequest(
    userId: string,
    addresseeId: string,
  ): Promise<void> {
    const friendRequest = await this.friendRepository.findOne({
      where: { requesterId: userId, addresseeId, status: FriendStatus.PENDING },
    });

    if (!friendRequest) {
      throw new NotFoundException(FriendErrorCode.REQUEST_NOT_FOUND);
    }

    await this.friendRepository.remove(friendRequest);
  }
}
