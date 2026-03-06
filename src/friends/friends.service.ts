import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Friend } from './entity/friend.entity';
import {
  FriendRequestType,
  FriendStatus,
  FriendsListSortBy,
} from './enums';
import { User } from '../users/entity/user.entity';
import { FriendErrorCode } from './errors';
import { sanitizeUserPublic } from '../common/utils/user-sanitizer.util';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserType } from '../users/enums';
import { NotificationService } from '../notifications/notification.service';

type FriendListItem = {
  user: ReturnType<typeof sanitizeUserPublic>;
  friendshipCreatedAt: Date;
};

type FriendSearchResult = {
  user: ReturnType<typeof sanitizeUserPublic>;
  friendshipStatus: FriendStatus | null;
  isRequester: boolean;
};

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional()
    @Inject(NotificationService)
    private readonly notificationService?: NotificationService,
    @Optional()
    @Inject(UserActivityService)
    private readonly userActivityService?: UserActivityService,
  ) {}

  async sendFriendRequest(
    requesterId: string,
    addresseeUsername: string,
    requesterUserType?: UserType,
  ): Promise<Friend> {
    if (requesterUserType === UserType.AUTHOR) {
      throw new BadRequestException(FriendErrorCode.AUTHORS_CANNOT_FRIEND);
    }

    const addressee = await this.userRepository.findOne({
      where: { username: addresseeUsername },
    });

    if (!addressee) {
      throw new NotFoundException(FriendErrorCode.USER_NOT_FOUND);
    }

    if (addressee.id === requesterId) {
      throw new BadRequestException(FriendErrorCode.CANNOT_FRIEND_SELF);
    }

    const existingFriendship = await this.findExistingFriendship(
      requesterId,
      addressee.id,
    );

    this.ensureNoActiveFriendship(existingFriendship);

    const friendRequest = this.friendRepository.create({
      requesterId,
      addresseeId: addressee.id,
      status: FriendStatus.PENDING,
    });

    const saved = await this.friendRepository.save(friendRequest);

    await this.notifyFriendRequestReceived(addressee.id, requesterId);

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

    await this.notifyFriendRequestAccepted(requesterId, userId);

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

    await this.notifyFriendRequestDeclined(requesterId, userId);
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
    type: FriendRequestType = FriendRequestType.RECEIVED,
  ): Promise<Friend[]> {
    const where: FindOptionsWhere<Friend> = { status: FriendStatus.PENDING };

    if (type === FriendRequestType.SENT) {
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
    sortBy?: FriendsListSortBy,
  ): Promise<ReturnType<typeof sanitizeUserPublic>[]> {
    const friendships = await this.friendRepository.find({
      where: [
        { requesterId: userId, status: FriendStatus.ACCEPTED },
        { addresseeId: userId, status: FriendStatus.ACCEPTED },
      ],
      relations: ['requester', 'addressee'],
      order: { createdAt: 'DESC' },
    });

    const friends = this.mapFriendshipsToFriendListItems(friendships, userId);
    const sortedFriends = await this.sortFriends(friends, sortBy);

    return sortedFriends.map((f) => f.user);
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
  ): Promise<FriendSearchResult[]> {
    if (!this.hasSearchQuery(query)) {
      return [];
    }

    const users = await this.findSearchableUsers(userId, query, limit);

    if (users.length === 0) {
      return [];
    }

    const friendships = await this.findFriendshipsForUsers(
      userId,
      users.map((u) => u.id),
    );
    const friendshipMap = this.buildFriendshipMap(userId, friendships);

    return this.mapUsersWithFriendshipStatus(users, friendshipMap);
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

  private async findExistingFriendship(
    requesterId: string,
    addresseeId: string,
  ): Promise<Friend | null> {
    return this.friendRepository.findOne({
      where: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    });
  }

  private ensureNoActiveFriendship(existingFriendship: Friend | null): void {
    if (!existingFriendship) {
      return;
    }

    if (existingFriendship.status === FriendStatus.ACCEPTED) {
      throw new ConflictException(FriendErrorCode.ALREADY_FRIENDS);
    }

    if (existingFriendship.status === FriendStatus.PENDING) {
      throw new ConflictException(FriendErrorCode.REQUEST_ALREADY_PENDING);
    }
  }

  private async getUserFullNameOrDefault(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return 'Someone';
    }

    return `${user.firstName} ${user.lastName}`;
  }

  private async safeNotify(
    notify: (service: NotificationService) => Promise<unknown | null>,
    context: string,
  ): Promise<void> {
    if (!this.notificationService) {
      console.warn('NotificationService not available in FriendsService');
      return;
    }

    try {
      const notification = await notify(this.notificationService);

      if (notification) {
        console.log(`${context} notification created`);
      } else {
        console.log(
          `${context} notification skipped (likely due to preferences)`,
        );
      }
    } catch (error) {
      console.error(`Failed to send ${context} notification:`, error);
      console.error('Error stack:', (error as Error)?.stack);
    }
  }

  private async notifyFriendRequestReceived(
    recipientId: string,
    requesterId: string,
  ): Promise<void> {
    const requesterName = await this.getUserFullNameOrDefault(requesterId);

    await this.safeNotify(
      (service) =>
        service.notifyFriendRequestReceived(
          recipientId,
          requesterId,
          requesterName,
        ),
      `Friend request for user ${recipientId}`,
    );
  }

  private async notifyFriendRequestAccepted(
    requesterId: string,
    accepterId: string,
  ): Promise<void> {
    const accepterName = await this.getUserFullNameOrDefault(accepterId);

    await this.safeNotify(
      (service) =>
        service.notifyFriendRequestAccepted(
          requesterId,
          accepterId,
          accepterName,
        ),
      `Friend request accepted for requester ${requesterId}`,
    );

    const requesterName = await this.getUserFullNameOrDefault(requesterId);

    await this.safeNotify(
      (service) =>
        service.notifyYouAcceptedFriendRequest(
          accepterId,
          requesterId,
          requesterName,
        ),
      `You accepted friend request for accepter ${accepterId}`,
    );
  }

  private async notifyFriendRequestDeclined(
    requesterId: string,
    declinerId: string,
  ): Promise<void> {
    const declinerName = await this.getUserFullNameOrDefault(declinerId);

    await this.safeNotify(
      (service) =>
        service.notifyFriendRequestDeclined(
          requesterId,
          declinerId,
          declinerName,
        ),
      `Friend request declined for requester ${requesterId}`,
    );

    const requesterName = await this.getUserFullNameOrDefault(requesterId);

    await this.safeNotify(
      (service) =>
        service.notifyYouDeclinedFriendRequest(
          declinerId,
          requesterId,
          requesterName,
        ),
      `You declined friend request for decliner ${declinerId}`,
    );
  }

  private async sortFriendsByActivity(
    friends: FriendListItem[],
  ): Promise<FriendListItem[]> {
    if (!this.userActivityService) {
      return friends;
    }

    const friendIds = friends.map((f) => f.user.id);
    const activityMap = await this.buildActivityMap(friendIds);

    return friends.sort((a, b) =>
      this.compareFriendsByActivity(a, b, activityMap),
    );
  }

  private mapFriendshipsToFriendListItems(
    friendships: Friend[],
    userId: string,
  ): FriendListItem[] {
    return friendships.map((friendship) => {
      const friend =
        friendship.requesterId === userId
          ? friendship.addressee
          : friendship.requester;

      return {
        user: sanitizeUserPublic(friend!),
        friendshipCreatedAt: friendship.createdAt,
      };
    });
  }

  private async sortFriends(
    friends: FriendListItem[],
    sortBy?: FriendsListSortBy,
  ): Promise<FriendListItem[]> {
    if (!sortBy) {
      return friends;
    }

    if (sortBy === FriendsListSortBy.ALPHABETICAL) {
      return [...friends].sort((a, b) => {
        const nameA = `${a.user.firstName} ${a.user.lastName}`.toLowerCase();
        const nameB = `${b.user.firstName} ${b.user.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    if (sortBy === FriendsListSortBy.RECENTLY_ADDED) {
      return friends;
    }

    return this.sortFriendsByActivity(friends);
  }

  private hasSearchQuery(query: string): boolean {
    return Boolean(query && query.trim().length > 0);
  }

  private createSearchTerm(query: string): string {
    return `%${query.trim()}%`;
  }

  private async findSearchableUsers(
    userId: string,
    query: string,
    limit: number,
  ): Promise<User[]> {
    const searchTerm = this.createSearchTerm(query);

    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id != :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .andWhere(
        "(user.username ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR CONCAT(user.firstName, ' ', user.lastName) ILIKE :search)",
        { search: searchTerm },
      )
      .limit(limit)
      .getMany();
  }

  private async findFriendshipsForUsers(
    userId: string,
    userIds: string[],
  ): Promise<Friend[]> {
    return this.friendRepository
      .createQueryBuilder('friend')
      .where(
        '(friend.requesterId = :userId AND friend.addresseeId IN (:...userIds)) OR (friend.addresseeId = :userId AND friend.requesterId IN (:...userIds))',
        { userId, userIds },
      )
      .getMany();
  }

  private buildFriendshipMap(
    userId: string,
    friendships: Friend[],
  ): Map<string, { status: FriendStatus; isRequester: boolean }> {
    const map = new Map<
      string,
      {
        status: FriendStatus;
        isRequester: boolean;
      }
    >();

    friendships.forEach((friendship) => {
      const otherUserId =
        friendship.requesterId === userId
          ? friendship.addresseeId
          : friendship.requesterId;

      map.set(otherUserId, {
        status: friendship.status,
        isRequester: friendship.requesterId === userId,
      });
    });

    return map;
  }

  private mapUsersWithFriendshipStatus(
    users: User[],
    friendshipMap: Map<string, { status: FriendStatus; isRequester: boolean }>,
  ): FriendSearchResult[] {
    return users.map((user) => {
      const friendship = friendshipMap.get(user.id);

      return {
        user: sanitizeUserPublic(user),
        friendshipStatus: friendship?.status ?? null,
        isRequester: friendship?.isRequester ?? false,
      };
    });
  }

  private async buildActivityMap(
    friendIds: string[],
  ): Promise<
    Map<
      string,
      {
        userId: string;
        lastActivity?: Date;
        totalActivities: number;
      }
    >
  > {
    if (!this.userActivityService) {
      return new Map();
    }

    const userActivityService = this.userActivityService;

    const summaries = await Promise.all(
      friendIds.map(async (friendId) => {
        const stats = await userActivityService.getActivityStats(friendId);
        return {
          userId: friendId,
          lastActivity: stats.lastActivity,
          totalActivities: stats.totalActivities,
        };
      }),
    );

    return new Map(summaries.map((summary) => [summary.userId, summary]));
  }

  private compareFriendsByActivity(
    a: FriendListItem,
    b: FriendListItem,
    activityMap: Map<
      string,
      { userId: string; lastActivity?: Date; totalActivities: number }
    >,
  ): number {
    const activityA = activityMap.get(a.user.id);
    const activityB = activityMap.get(b.user.id);

    if (activityA?.lastActivity && activityB?.lastActivity) {
      return (
        activityB.lastActivity.getTime() - activityA.lastActivity.getTime()
      );
    }

    if (activityA?.lastActivity) return -1;
    if (activityB?.lastActivity) return 1;

    const totalA = activityA?.totalActivities ?? 0;
    const totalB = activityB?.totalActivities ?? 0;

    return totalB - totalA;
  }
}
