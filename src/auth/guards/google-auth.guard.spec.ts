import { GoogleAuthGuard } from './google-auth.guard';

describe('GoogleAuthGuard', () => {
  it('can be instantiated', () => {
    const guard = new GoogleAuthGuard();
    expect(guard).toBeInstanceOf(GoogleAuthGuard);
  });
});
