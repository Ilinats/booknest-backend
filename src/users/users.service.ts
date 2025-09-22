import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { User } from './entity/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: [{ username: createDto.username }, { email: createDto.email }] });
    if (existing) {
      throw new ConflictException({ message: 'User already exists', code: 'USER_EXISTS' });
    }

    const user = this.usersRepository.create({
      username: createDto.username,
      email: createDto.email.toLowerCase(),
      passwordHash: '',
      firstName: createDto.firstName,
      lastName: createDto.lastName,
      userType: createDto.userType,
      birthDate: createDto.birthDate ?? null,
      bio: createDto.bio ?? null,
      avatarUrl: createDto.avatarUrl ?? null,
      isActive: createDto.isActive ?? true,
    });

    return this.usersRepository.save(user);
  }

  async findAll(query?: { search?: string; skip?: number; take?: number; isActive?: boolean }): Promise<{ data: User[]; total: number }> {
    const where: FindOptionsWhere<User>[] = [];

    if (query?.search) {
      const s = query.search.trim();
      where.push({ username: ILike(`%${s}%`) });
      where.push({ email: ILike(`%${s}%`) });
      where.push({ firstName: ILike(`%${s}%`) });
      where.push({ lastName: ILike(`%${s}%`) });
    }

    const [data, total] = await this.usersRepository.findAndCount({
      where: where.length ? where : undefined,
      skip: query?.skip ?? 0,
      take: Math.min(query?.take ?? 50, 100),
      order: { createdAt: 'DESC' },
    });

    return { data, total };
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  async update(id: string, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.findOneById(id);

    if (updateDto.username || updateDto.email) {
      const duplicate = await this.usersRepository.findOne({
        where: [
          updateDto.username ? { username: updateDto.username } : undefined,
          updateDto.email ? { email: updateDto.email.toLowerCase() } : undefined,
        ].filter(Boolean) as FindOptionsWhere<User>[],
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({ message: 'User already exists', code: 'USER_EXISTS' });
      }
    }

    Object.assign(user, {
      username: updateDto.username ?? user.username,
      email: updateDto.email ? updateDto.email.toLowerCase() : user.email,
      firstName: updateDto.firstName ?? user.firstName,
      lastName: updateDto.lastName ?? user.lastName,
      birthDate: updateDto.birthDate ?? user.birthDate,
      bio: updateDto.bio ?? user.bio,
      avatarUrl: updateDto.avatarUrl ?? user.avatarUrl,
      isActive: typeof updateDto.isActive === 'boolean' ? updateDto.isActive : user.isActive,
    });

    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const res = await this.usersRepository.delete(id);
    if (!res.affected) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
  }
} 