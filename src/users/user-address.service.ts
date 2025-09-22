import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAddress } from './entity/user-address.entity';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class UserAddressService {
  constructor(
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
  ) {}

  async create(userId: string, createAddressDto: CreateAddressDto): Promise<UserAddress> {
    const address = this.userAddressRepository.create({
      userId,
      streetAddress: createAddressDto.streetAddress,
      city: createAddressDto.city,
      postalCode: createAddressDto.postalCode,
      country: createAddressDto.country ?? 'Bulgaria',
      isPrimary: createAddressDto.isPrimary ?? true,
    });

    return this.userAddressRepository.save(address);
  }

  async findByUserId(userId: string): Promise<UserAddress[]> {
    return this.userAddressRepository.find({
      where: { userId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async findPrimaryByUserId(userId: string): Promise<UserAddress | null> {
    return this.userAddressRepository.findOne({
      where: { userId, isPrimary: true },
    });
  }

  async setPrimary(userId: string, addressId: string): Promise<void> {
    await this.userAddressRepository.update(
      { userId },
      { isPrimary: false }
    );

    await this.userAddressRepository.update(
      { id: addressId, userId },
      { isPrimary: true }
    );
  }

  async remove(userId: string, addressId: string): Promise<void> {
    const result = await this.userAddressRepository.delete({
      id: addressId,
      userId,
    });

    if (result.affected === 0) {
      throw new Error('Address not found or access denied');
    }
  }
}
