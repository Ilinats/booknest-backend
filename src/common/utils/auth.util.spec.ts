import { ForbiddenException } from '@nestjs/common';
import { ensureAuthor } from './auth.util';
import { UserType } from '../../users/enums';

describe('auth.util - ensureAuthor', () => {
  it('allows when userType is UserType.AUTHOR', () => {
    expect(() => ensureAuthor(UserType.AUTHOR)).not.toThrow();
  });

  it("allows when userType is literal 'author'", () => {
    expect(() => ensureAuthor('author')).not.toThrow();
  });

  it('throws ForbiddenException for non-author userType', () => {
    expect(() => ensureAuthor(UserType.READER)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when userType is undefined', () => {
    expect(() => ensureAuthor(undefined)).toThrow(ForbiddenException);
  });
});
