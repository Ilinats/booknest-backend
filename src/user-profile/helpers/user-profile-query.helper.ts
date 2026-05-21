import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { User } from '../../users/entity/user.entity';
import { UserType } from '../../users/enums';
import { PrivacyLevel } from '../enums';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function findUserByUsernameOrId(
  userRepository: Repository<User>,
  usernameOrId: string,
): Promise<User | null> {
  if (isUuid(usernameOrId)) {
    const byId = await userRepository.findOne({
      where: { id: usernameOrId },
    });
    if (byId) {
      return byId;
    }
  }

  const byUsername = await userRepository.findOne({
    where: { username: usernameOrId },
  });
  if (byUsername) {
    return byUsername;
  }

  if (!isUuid(usernameOrId)) {
    return userRepository.findOne({ where: { id: usernameOrId } });
  }

  return null;
}

export function enforceAuthorPublicProfilePrivacy(
  user: User,
  profilePrivacy?: PrivacyLevel,
): PrivacyLevel | undefined {
  if (user.userType !== UserType.AUTHOR) {
    return profilePrivacy;
  }

  if (
    profilePrivacy !== undefined &&
    profilePrivacy !== PrivacyLevel.PUBLIC
  ) {
    throw new BadRequestException(
      'Authors cannot set their profile privacy to private or friends-only. Author profiles must be public.',
    );
  }

  return PrivacyLevel.PUBLIC;
}

export function canViewProfileByPrivacy(
  privacy: PrivacyLevel,
  options: {
    isOwner: boolean;
    isFriend: boolean;
    isAuthor: boolean;
  },
): boolean {
  if (options.isOwner || options.isAuthor) {
    return true;
  }

  if (privacy === PrivacyLevel.PUBLIC) {
    return true;
  }

  if (privacy === PrivacyLevel.FRIENDS && options.isFriend) {
    return true;
  }

  return false;
}
