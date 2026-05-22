import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { FriendStatus } from '../enums';
import { sanitizeUserPublic } from '../../common/utils/user-sanitizer.util';
import { FriendsQueryHelper } from './friends-query.helper';
import { Friend } from '../entity/friend.entity';
import { FriendSearchResult } from '../types/friends-list.types';

@Injectable()
export class FriendsSearchHelper {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly friendsQueryHelper: FriendsQueryHelper,
  ) {}

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

    const friendships = await this.friendsQueryHelper.findFriendshipsForUsers(
      userId,
      users.map((u) => u.id),
    );
    const friendshipMap = this.buildFriendshipMap(userId, friendships);

    return this.mapUsersWithFriendshipStatus(users, friendshipMap);
  }

  private hasSearchQuery(query: string): boolean {
    return Boolean(query && query.trim().length > 0);
  }

  private createSearchTerm(query: string): string {
    return `%${query.trim()}%`;
  }

  private findSearchableUsers(
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

  private buildFriendshipMap(
    userId: string,
    friendships: Friend[],
  ): Map<string, { status: FriendStatus; isRequester: boolean }> {
    const map = new Map<
      string,
      { status: FriendStatus; isRequester: boolean }
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
}
