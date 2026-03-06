import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserAddressService } from './user-address.service';
import { UserAddress } from './entity/user-address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { NotFoundException } from '@nestjs/common';
import {
  UserAddressErrorCode,
  UserAddressErrors,
} from './errors/user-address-errors';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

describe('UserAddressService', () => {
  let service: UserAddressService;
  let userAddressRepository: MockRepo<UserAddress>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAddressService,
        {
          provide: getRepositoryToken(UserAddress),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<UserAddressService>(UserAddressService);
    userAddressRepository = module.get(getRepositoryToken(UserAddress));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const baseDto: CreateAddressDto = {
      streetAddress: 'Street 1',
      city: 'Sofia',
      postalCode: '1000',
      country: 'Bulgaria',
    } as any;

    it('should clear existing primary when isPrimary not explicitly false', async () => {
      const created: UserAddress = {
        id: 'addr-1',
        userId: 'u1',
        ...baseDto,
        isPrimary: true,
      } as any;

      userAddressRepository.create.mockReturnValue(created);
      userAddressRepository.save.mockResolvedValue(created);

      const result = await service.create('u1', baseDto);

      expect(userAddressRepository.update).toHaveBeenCalledWith(
        { userId: 'u1' },
        { isPrimary: false },
      );
      expect(userAddressRepository.create).toHaveBeenCalledWith({
        userId: 'u1',
        streetAddress: baseDto.streetAddress,
        city: baseDto.city,
        postalCode: baseDto.postalCode,
        country: baseDto.country ?? 'Bulgaria',
        isPrimary: true,
      });
      expect(result).toEqual(created);
    });

    it('should not clear primary when isPrimary is false', async () => {
      const dto: CreateAddressDto = {
        ...baseDto,
        isPrimary: false,
      } as any;

      const created: UserAddress = {
        id: 'addr-1',
        userId: 'u1',
        ...dto,
      } as any;

      userAddressRepository.create.mockReturnValue(created);
      userAddressRepository.save.mockResolvedValue(created);

      const result = await service.create('u1', dto);

      expect(userAddressRepository.update).not.toHaveBeenCalled();
      expect(created.isPrimary).toBe(false);
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    const baseDto: UpdateAddressDto = {
      streetAddress: 'New Street',
      city: 'Plovdiv',
      postalCode: '4000',
      country: 'Bulgaria',
      isPrimary: true,
    } as any;

    it('should throw NotFoundException when address not found', async () => {
      userAddressRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('u1', 'addr-1', baseDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should clear other primaries when isPrimary true', async () => {
      const address: UserAddress = {
        id: 'addr-1',
        userId: 'u1',
        streetAddress: 'Old',
        city: 'Old',
        postalCode: '0000',
        country: 'Bulgaria',
        isPrimary: false,
      } as any;

      userAddressRepository.findOne.mockResolvedValue(address);
      userAddressRepository.save.mockImplementation(async (a) => a);

      const result = await service.update('u1', 'addr-1', baseDto);

      expect(userAddressRepository.update).toHaveBeenCalledWith(
        { userId: 'u1', id: Not('addr-1') },
        { isPrimary: false },
      );
      expect(result.streetAddress).toBe(baseDto.streetAddress);
      expect(result.city).toBe(baseDto.city);
      expect(result.isPrimary).toBe(true);
    });
  });

  describe('findByUserId', () => {
    it('should return addresses ordered by primary and createdAt', async () => {
      const addresses: UserAddress[] = [{ id: '1', userId: 'u1' } as any];

      userAddressRepository.find.mockResolvedValue(addresses);

      const result = await service.findByUserId('u1');

      expect(userAddressRepository.find).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        order: { isPrimary: 'DESC', createdAt: 'ASC' },
      });
      expect(result).toEqual(addresses);
    });
  });

  describe('findPrimaryByUserId', () => {
    it('should return primary address for user', async () => {
      const address: UserAddress = {
        id: '1',
        userId: 'u1',
        isPrimary: true,
      } as any;

      userAddressRepository.findOne.mockResolvedValue(address);

      const result = await service.findPrimaryByUserId('u1');

      expect(userAddressRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', isPrimary: true },
      });
      expect(result).toEqual(address);
    });
  });

  describe('setPrimary', () => {
    it('should clear all primaries and set given address as primary', async () => {
      await service.setPrimary('u1', 'addr-1');

      expect(userAddressRepository.update).toHaveBeenNthCalledWith(
        1,
        { userId: 'u1' },
        { isPrimary: false },
      );
      expect(userAddressRepository.update).toHaveBeenNthCalledWith(
        2,
        { id: 'addr-1', userId: 'u1' },
        { isPrimary: true },
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when nothing deleted', async () => {
      userAddressRepository.delete.mockResolvedValue({ affected: 0 } as any);

      await expect(service.remove('u1', 'addr-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should not throw when deletion affected > 0', async () => {
      userAddressRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await expect(service.remove('u1', 'addr-1')).resolves.toBeUndefined();
    });
  });
});
