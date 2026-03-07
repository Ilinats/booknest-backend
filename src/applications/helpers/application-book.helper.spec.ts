import { ApplicationBookHelper } from './application-book.helper';
import { Book } from '../../books/entity';
import { BookStatus, DistributionType } from '../../books/enums';

describe('ApplicationBookHelper', () => {
  const mockBookRepo = {
    decrement: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('decrementAvailableCopies', () => {
    it('decrements by 1 by default and does not change status when copies remain', async () => {
      mockBookRepo.findOne.mockResolvedValue({
        id: 'b1',
        availableCopies: 2,
        status: BookStatus.ACTIVE,
      });

      await ApplicationBookHelper.decrementAvailableCopies(
        mockBookRepo as any,
        'b1',
      );

      expect(mockBookRepo.decrement).toHaveBeenCalledWith(
        { id: 'b1' },
        'availableCopies',
        1,
      );
      expect(mockBookRepo.save).not.toHaveBeenCalled();
    });

    it('decrements by given count', async () => {
      mockBookRepo.findOne.mockResolvedValue({
        id: 'b1',
        availableCopies: 1,
        status: BookStatus.ACTIVE,
      });

      await ApplicationBookHelper.decrementAvailableCopies(
        mockBookRepo as any,
        'b1',
        3,
      );

      expect(mockBookRepo.decrement).toHaveBeenCalledWith(
        { id: 'b1' },
        'availableCopies',
        3,
      );
    });

    it('sets status to IN_PROGRESS when availableCopies becomes 0 and was ACTIVE', async () => {
      const updatedBook = {
        id: 'b1',
        availableCopies: 0,
        status: BookStatus.ACTIVE,
      };
      mockBookRepo.findOne.mockResolvedValue(updatedBook);

      await ApplicationBookHelper.decrementAvailableCopies(
        mockBookRepo as any,
        'b1',
        1,
      );

      expect(mockBookRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BookStatus.IN_PROGRESS,
          availableCopies: 0,
        }),
      );
    });

    it('does not change status when availableCopies is 0 but status is not ACTIVE', async () => {
      mockBookRepo.findOne.mockResolvedValue({
        id: 'b1',
        availableCopies: 0,
        status: BookStatus.IN_PROGRESS,
      });

      await ApplicationBookHelper.decrementAvailableCopies(
        mockBookRepo as any,
        'b1',
        1,
      );

      expect(mockBookRepo.save).not.toHaveBeenCalled();
    });

    it('does not save when findOne returns null', async () => {
      mockBookRepo.findOne.mockResolvedValue(null);

      await ApplicationBookHelper.decrementAvailableCopies(
        mockBookRepo as any,
        'b1',
        1,
      );

      expect(mockBookRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('shouldSetCopySentAt', () => {
    it('returns true for digital distribution', () => {
      const book = { distributionType: DistributionType.DIGITAL } as Book;
      expect(ApplicationBookHelper.shouldSetCopySentAt(book)).toBe(true);
    });

    it('returns false for physical distribution', () => {
      const book = { distributionType: DistributionType.PHYSICAL } as Book;
      expect(ApplicationBookHelper.shouldSetCopySentAt(book)).toBe(false);
    });

    it('returns false for both distribution', () => {
      const book = { distributionType: DistributionType.BOTH } as Book;
      expect(ApplicationBookHelper.shouldSetCopySentAt(book)).toBe(false);
    });
  });
});
