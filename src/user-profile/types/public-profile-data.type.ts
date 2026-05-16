import { PrivacyLevel } from '../enums';
import type { SocialMediaLinks } from './social-media-links.type';

export type PublicProfileData = {
  socialMedia?: SocialMediaLinks;
  stats?: Record<string, unknown>;
  profilePrivacy?: PrivacyLevel;
  activityPrivacy?: PrivacyLevel;
  readingListPrivacy?: PrivacyLevel;
  reviewsPrivacy?: PrivacyLevel;
};
