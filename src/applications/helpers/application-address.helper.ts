import { Repository, In } from 'typeorm';
import { Application } from '../entity/application.entity';
import { UserAddress } from '../../user-address/entity/user-address.entity';
import { Book } from '../../books/entity';
import { DistributionType } from 'src/books/enums';

export class ApplicationAddressHelper {
  static async attachReaderAddresses(
    applications: Application[],
    book: Book,
    userAddressRepo: Repository<UserAddress>,
  ): Promise<void> {
    const needsPhysicalAddress =
      book.distributionType === DistributionType.PHYSICAL ||
      book.distributionType === DistributionType.BOTH;

    if (!needsPhysicalAddress || applications.length === 0) {
      return;
    }

    const readerIds = applications.map((app) => app.readerId);
    const addresses = await userAddressRepo.find({
      where: { userId: In(readerIds) },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });

    const readerAddressesMap = new Map<string, UserAddress[]>();
    addresses.forEach((addr) => {
      const existing = readerAddressesMap.get(addr.userId) || [];
      existing.push(addr);
      readerAddressesMap.set(addr.userId, existing);
    });

    applications.forEach((app) => {
      if (app.reader) {
        const readerAddresses = readerAddressesMap.get(app.readerId) || [];
        app.reader.addresses = readerAddresses;
      }
    });
  }
}
