import { ApplicationAddressHelper } from './application-address.helper';
import { Application } from '../entity/application.entity';
import { UserAddress } from '../../user-address/entity/user-address.entity';
import { Book } from '../../books/entity';
import { DistributionType } from '../../books/enums';

describe('ApplicationAddressHelper', () => {
  const mockUserAddressRepo = {
    find: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('attachReaderAddresses', () => {
    it('returns early when book is digital (no physical address needed)', async () => {
      const book = { distributionType: DistributionType.DIGITAL } as Book;
      const applications: Application[] = [{ readerId: 'r1' } as Application];

      await ApplicationAddressHelper.attachReaderAddresses(
        applications,
        book,
        mockUserAddressRepo as any,
      );

      expect(mockUserAddressRepo.find).not.toHaveBeenCalled();
    });

    it('returns early when applications array is empty', async () => {
      const book = {
        distributionType: DistributionType.PHYSICAL,
      } as Book;

      await ApplicationAddressHelper.attachReaderAddresses(
        [],
        book,
        mockUserAddressRepo as any,
      );

      expect(mockUserAddressRepo.find).not.toHaveBeenCalled();
    });

    it('loads addresses and assigns them to reader when book needs physical', async () => {
      const book = {
        distributionType: DistributionType.PHYSICAL,
      } as Book;
      const addr1 = { userId: 'r1', id: 'a1' } as UserAddress;
      const addr2 = { userId: 'r1', id: 'a2' } as UserAddress;
      mockUserAddressRepo.find.mockResolvedValue([addr1, addr2]);

      const app1 = {
        readerId: 'r1',
        reader: { addresses: [] as UserAddress[] },
      } as Application;
      const applications = [app1];

      await ApplicationAddressHelper.attachReaderAddresses(
        applications,
        book,
        mockUserAddressRepo as any,
      );

      expect(mockUserAddressRepo.find).toHaveBeenCalledWith({
        where: { userId: expect.anything() },
        order: { isPrimary: 'DESC', createdAt: 'ASC' },
      });
      expect(app1.reader!.addresses).toEqual([addr1, addr2]);
    });

    it('does not set addresses when app has no reader', async () => {
      const book = {
        distributionType: DistributionType.BOTH,
      } as Book;
      mockUserAddressRepo.find.mockResolvedValue([]);

      const appNoReader = { readerId: 'r1', reader: undefined } as unknown as Application;
      const applications = [appNoReader];

      await ApplicationAddressHelper.attachReaderAddresses(
        applications,
        book,
        mockUserAddressRepo as any,
      );

      expect(mockUserAddressRepo.find).toHaveBeenCalled();
      expect(appNoReader.reader).toBeUndefined();
    });

    it('assigns empty array when reader has no addresses', async () => {
      const book = { distributionType: DistributionType.PHYSICAL } as Book;
      mockUserAddressRepo.find.mockResolvedValue([]);

      const app = {
        readerId: 'r1',
        reader: { addresses: [] as UserAddress[] },
      } as Application;

      await ApplicationAddressHelper.attachReaderAddresses(
        [app],
        book,
        mockUserAddressRepo as any,
      );

      expect(app.reader!.addresses).toEqual([]);
    });
  });
});
