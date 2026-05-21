import { ApplicationBookHelper } from './application-book.helper';
import { Book } from '../../books/entity';
import { BookStatus, DistributionType } from '../../books/enums';

describe('ApplicationBookHelper', () => {
  const createQueryBuilder = (affected: number) => ({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  });

  const mockBookRepo = {
    findOne: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tryReserveCopies', () => {
    it('returns false when no rows updated', async () => {
      mockBookRepo.createQueryBuilder.mockReturnValue(createQueryBuilder(0));

      const result = await ApplicationBookHelper.tryReserveCopies(
        mockBookRepo as any,
        'b1',
        1,
      );

      expect(result).toBe(false);
      expect(mockBookRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns true and syncs status when a copy is reserved', async () => {
      mockBookRepo.createQueryBuilder.mockReturnValue(createQueryBuilder(1));
      mockBookRepo.findOne.mockResolvedValue({
        id: 'b1',
        availableCopies: 0,
        status: BookStatus.ACTIVE,
      });

      const result = await ApplicationBookHelper.tryReserveCopies(
        mockBookRepo as any,
        'b1',
        1,
      );

      expect(result).toBe(true);
      expect(mockBookRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: BookStatus.IN_PROGRESS }),
      );
    });

    it('returns true without saving when copies remain', async () => {
      mockBookRepo.createQueryBuilder.mockReturnValue(createQueryBuilder(1));
      mockBookRepo.findOne.mockResolvedValue({
        id: 'b1',
        availableCopies: 2,
        status: BookStatus.ACTIVE,
      });

      const result = await ApplicationBookHelper.tryReserveCopies(
        mockBookRepo as any,
        'b1',
        2,
      );

      expect(result).toBe(true);
      expect(mockBookRepo.save).not.toHaveBeenCalled();
    });

    it('returns true for count <= 0 without querying', async () => {
      const result = await ApplicationBookHelper.tryReserveCopies(
        mockBookRepo as any,
        'b1',
        0,
      );

      expect(result).toBe(true);
      expect(mockBookRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('shouldSetCopySentAt', () => {
    it('returns true for digital distribution', () => {
      expect(
        ApplicationBookHelper.shouldSetCopySentAt({
          distributionType: DistributionType.DIGITAL,
        } as Book),
      ).toBe(true);
    });

    it('returns false for physical distribution', () => {
      expect(
        ApplicationBookHelper.shouldSetCopySentAt({
          distributionType: DistributionType.PHYSICAL,
        } as Book),
      ).toBe(false);
    });
  });
});
