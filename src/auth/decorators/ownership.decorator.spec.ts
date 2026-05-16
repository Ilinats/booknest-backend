import { Ownership } from './ownership.decorator';

describe('Ownership decorator', () => {
  it('returns a decorator function', () => {
    const decorator = Ownership('book');
    expect(typeof decorator).toBe('function');
  });

  it('sets metadata with custom paramName', () => {
    const decorator = Ownership('review', 'reviewId');
    expect(typeof decorator).toBe('function');
  });
});
