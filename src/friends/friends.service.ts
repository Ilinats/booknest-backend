import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friend } from './entity/friend.entity';
import { FriendRequestType, FriendStatus, FriendsListSortBy } from './enums';
import { User } from '../users/entity/user.entity';
import { FriendErrorCode } from './errors';
import { sanitizeUserPublic } from '../common/utils/user-sanitizer.util';
import { UserType } from '../users/enums';
import {
  FriendsListHelper,
  FriendsNotificationsHelper,
  FriendsQueryHelper,
  FriendsSearchHelper,
} from './helpers';
import { FriendSearchResult } from './types/friends-list.types';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly friendsQueryHelper: FriendsQueryHelper,
    private readonly friendsListHelper: FriendsListHelper,
    private readonly friendsSearchHelper: FriendsSearchHelper,
    private readonly friendsNotificationsHelper: FriendsNotificationsHelper,
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

    const existingFriendship =
      await this.friendsQueryHelper.findExistingFriendship(
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

    await this.friendsNotificationsHelper.notifyFriendRequestReceived(
      addressee.id,
      requesterId,
    );

    return saved;
  }

  async acceptFriendRequest(
    userId: string,
    requesterId: string,
  ): Promise<Friend> {
    const friendRequest =
      await this.friendsQueryHelper.findPendingRequestOrThrow(
        requesterId,
        userId,
      );

    friendRequest.status = FriendStatus.ACCEPTED;
    const saved = await this.friendRepository.save(friendRequest);

    await this.friendsNotificationsHelper.notifyFriendRequestAccepted(
      requesterId,
      userId,
    );

    return saved;
  }

  async declineFriendRequest(
    userId: string,
    requesterId: string,
  ): Promise<void> {
    const friendRequest =
      await this.friendsQueryHelper.findPendingRequestOrThrow(
        requesterId,
        userId,
      );

    await this.friendRepository.remove(friendRequest);

    await this.friendsNotificationsHelper.notifyFriendRequestDeclined(
      requesterId,
      userId,
    );
  }

  async unfriend(userId: string, friendId: string): Promise<void> {
    const friendship =
      await this.friendsQueryHelper.findAcceptedFriendshipOrThrow(
        userId,
        friendId,
      );

    await this.friendRepository.remove(friendship);
  }

  async getPendingFriendRequests(
    userId: string,
    type: FriendRequestType = FriendRequestType.RECEIVED,
  ): Promise<ReturnType<typeof sanitizeUserPublic>[]> {
    const isSent = type === FriendRequestType.SENT;

    const friendships = await this.friendRepository.find({
      where: isSent
        ? { requesterId: userId, status: FriendStatus.PENDING }
        : { addresseeId: userId, status: FriendStatus.PENDING },
      relations: [isSent ? 'addressee' : 'requester'],
      order: { createdAt: 'DESC' },
    });

    return friendships.map((friendship) =>
      sanitizeUserPublic(
        (isSent ? friendship.addressee : friendship.requester)!,
      ),
    );
  }

  async getFriendshipStatus(
    userId: string,
    targetUserId: string,
  ): Promise<{
    status: FriendStatus | null;
    isRequester: boolean;
  }> {
    const friendship = await this.friendsQueryHelper.findFriendshipBetween(
      userId,
      targetUserId,
    );

    if (!friendship) {
      return { status: null, isRequester: false };
    }

    return {
      status: friendship.status,
      isRequester: friendship.requesterId === userId,
    };
  }

  async getFriendIds(userId: string): Promise<string[]> {
    return this.friendsQueryHelper.getAcceptedFriendIds(userId);
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    return this.friendsQueryHelper.areFriends(userId1, userId2);
  }

  async getFriendsList(
    userId: string,
    sortBy?: FriendsListSortBy,
  ): Promise<ReturnType<typeof sanitizeUserPublic>[]> {
    const friendships = await this.friendsQueryHelper.findAcceptedFriendships(
      userId,
      ['requester', 'addressee'],
    );

    const friends = this.friendsListHelper.mapFriendshipsToFriendListItems(
      friendships,
      userId,
    );
    const sortedFriends = await this.friendsListHelper.sortFriends(
      friends,
      sortBy,
    );

    return sortedFriends.map((f) => f.user);
  }

  async searchUsersForFriends(
    userId: string,
    query: string,
    limit: number = 20,
  ): Promise<FriendSearchResult[]> {
    return this.friendsSearchHelper.searchUsersForFriends(userId, query, limit);
  }

  async cancelFriendRequest(
    userId: string,
    addresseeId: string,
  ): Promise<void> {
    const friendRequest =
      await this.friendsQueryHelper.findPendingRequestOrThrow(
        userId,
        addresseeId,
      );

    await this.friendRepository.remove(friendRequest);
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
}
