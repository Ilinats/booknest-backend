import { UserType } from '../../users/enums';

export type PublicProfileUser = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  userType: UserType;
  bio?: string | null;
  avatarUrl?: string | null;
  isVerified: boolean;
  createdAt: Date;
};
