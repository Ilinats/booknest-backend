import { Inject, Injectable, Optional } from '@nestjs/common';
import { Friend } from '../entity/friend.entity';
import { FriendsListSortBy } from '../enums';
import { sanitizeUserPublic } from '../../common/utils/user-sanitizer.util';
import { UserActivityService } from '../../user-activity/user-activity.service';
import {
  FriendActivitySummary,
  FriendListItem,
} from '../types/friends-list.types';

@Injectable()
export class FriendsListHelper {
  constructor(
    @Optional()
    @Inject(UserActivityService)
    private readonly userActivityService?: UserActivityService,
  ) {}

  mapFriendshipsToFriendListItems(
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

  async sortFriends(
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

  private async buildActivityMap(
    friendIds: string[],
  ): Promise<Map<string, FriendActivitySummary>> {
    if (!this.userActivityService || friendIds.length === 0) {
      return new Map();
    }

    const summaries = await Promise.all(
      friendIds.map(async (friendId) => {
        const stats = await this.userActivityService!.getActivityStats(
          friendId,
        );
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
    activityMap: Map<string, FriendActivitySummary>,
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
