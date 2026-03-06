import { PrivacyLevel } from '../enums';

export type PrivacySettings = {
  activityPrivacy?: PrivacyLevel;
  profilePrivacy?: PrivacyLevel;
  readingListPrivacy?: PrivacyLevel;
  reviewsPrivacy?: PrivacyLevel;
};

