import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserAddress } from './entity/user-address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import {
  UserAddressErrorCode,
  UserAddressErrors,
} from './errors/user-address-errors';

@Injectable()
export class UserAddressService {
  constructor(
    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
  ) {}

  async create(
    userId: string,
    createAddressDto: CreateAddressDto,
  ): Promise<UserAddress> {
    if (createAddressDto.isPrimary !== false) {
      await this.userAddressRepository.update({ userId }, { isPrimary: false });
    }

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

  async update(
    userId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<UserAddress> {
    const address = await this.userAddressRepository.findOne({
      where: { id: addressId, userId },
    });

    if (!address) {
      const error =
        UserAddressErrors[UserAddressErrorCode.ADDRESS_ACCESS_DENIED];
      throw new NotFoundException({
        message: error.message,
        code: error.code,
      });
    }

    if (updateAddressDto.isPrimary === true) {
      await this.userAddressRepository.update(
        { userId, id: Not(addressId) },
        { isPrimary: false },
      );
    }

    if (updateAddressDto.streetAddress !== undefined) {
      address.streetAddress = updateAddressDto.streetAddress;
    }
    if (updateAddressDto.city !== undefined) {
      address.city = updateAddressDto.city;
    }
    if (updateAddressDto.postalCode !== undefined) {
      address.postalCode = updateAddressDto.postalCode;
    }
    if (updateAddressDto.country !== undefined) {
      address.country = updateAddressDto.country;
    }
    if (updateAddressDto.isPrimary !== undefined) {
      address.isPrimary = updateAddressDto.isPrimary;
    }

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
    await this.userAddressRepository.update({ userId }, { isPrimary: false });

    await this.userAddressRepository.update(
      { id: addressId, userId },
      { isPrimary: true },
    );
  }

  async remove(userId: string, addressId: string): Promise<void> {
    const result = await this.userAddressRepository.delete({
      id: addressId,
      userId,
    });

    if (result.affected === 0) {
      const error =
        UserAddressErrors[UserAddressErrorCode.ADDRESS_ACCESS_DENIED];
      throw new NotFoundException({
        message: error.message,
        code: error.code,
      });
    }
  }
}
