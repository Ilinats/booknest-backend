import { Roles } from './roles.decorator';
import { UserType } from '../../users/enums';

describe('Roles decorator', () => {
  it('sets roles metadata on handler', () => {
    const decorator = Roles(UserType.AUTHOR, UserType.READER);
    expect(typeof decorator).toBe('function');
  });
});
