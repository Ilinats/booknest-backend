import type { PublicProfileUser } from './public-profile-user.type';
import type { PublicProfileData } from './public-profile-data.type';

export type PublicProfileResponse = {
  user: PublicProfileUser;
  profile: PublicProfileData;
  isFriend?: boolean;
};

