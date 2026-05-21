import { FriendStatus } from '../enums';
import { sanitizeUserPublic } from '../../common/utils/user-sanitizer.util';

export type FriendListItem = {
  user: ReturnType<typeof sanitizeUserPublic>;
  friendshipCreatedAt: Date;
};

export type FriendSearchResult = {
  user: ReturnType<typeof sanitizeUserPublic>;
  friendshipStatus: FriendStatus | null;
  isRequester: boolean;
};

export type FriendActivitySummary = {
  userId: string;
  lastActivity?: Date;
  totalActivities: number;
};
