import { Injectable, NotFoundException, ConflictException, BadRequestException, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Friend, FriendStatus } from './entity/friend.entity';
import { User } from './entity/user.entity';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional()
    @Inject('NotificationService')
    private readonly notificationService?: any,
  ) {}

  async sendFriendRequest(requesterId: string, addresseeUsername: string): Promise<Friend> {
    if (requesterId === addresseeUsername) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const addressee = await this.userRepository.findOne({ 
      where: { username: addresseeUsername } 
    });
    
    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    const existingFriendship = await this.friendRepository.findOne({
      where: [
        { requesterId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: requesterId }
      ]
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        throw new ConflictException('Users are already friends');
      } else if (existingFriendship.status === 'pending') {
        throw new ConflictException('Friend request already pending');
      } else if (existingFriendship.status === 'blocked') {
        throw new ConflictException('Cannot send friend request to blocked user');
      }
    }

    const friendRequest = this.friendRepository.create({
      requesterId,
      addresseeId: addressee.id,
      status: 'pending'
    });

    const saved = await this.friendRepository.save(friendRequest);

    if (this.notificationService) {
      const requester = await this.userRepository.findOne({ where: { id: requesterId } });
      const requesterName = requester ? `${requester.firstName} ${requester.lastName}` : 'Someone';
      this.notificationService.notifyFriendRequestReceived(
        addressee.id,
        requesterId,
        requesterName,
      ).catch((err: any) => console.error('Failed to send friend request notification:', err));
    }

    return saved;
  }

  async acceptFriendRequest(userId: string, requesterId: string): Promise<Friend> {
    const friendRequest = await this.friendRepository.findOne({
      where: { requesterId, addresseeId: userId, status: 'pending' }
    });

    if (!friendRequest) {
      throw new NotFoundException('Friend request not found');
    }

    friendRequest.status = 'accepted';
    const saved = await this.friendRepository.save(friendRequest);

    if (this.notificationService) {
      const accepter = await this.userRepository.findOne({ where: { id: userId } });
      const accepterName = accepter ? `${accepter.firstName} ${accepter.lastName}` : 'Someone';
      this.notificationService.notifyFriendRequestAccepted(
        requesterId,
        userId,
        accepterName,
      ).catch((err: any) => console.error('Failed to send friend accepted notification:', err));
    }

    return saved;
  }

  async declineFriendRequest(userId: string, requesterId: string): Promise<void> {
    const friendRequest = await this.friendRepository.findOne({
      where: { requesterId, addresseeId: userId, status: 'pending' }
    });

    if (!friendRequest) {
      throw new NotFoundException('Friend request not found');
    }

    await this.friendRepository.remove(friendRequest);
  }

  async unfriend(userId: string, friendId: string): Promise<void> {
    const friendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId, addresseeId: friendId, status: 'accepted' },
        { requesterId: friendId, addresseeId: userId, status: 'accepted' }
      ]
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.friendRepository.remove(friendship);
  }

  async blockUser(userId: string, targetUserId: string): Promise<Friend> {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const existingFriendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: userId }
      ]
    });

    if (existingFriendship) {
      await this.friendRepository.remove(existingFriendship);
    }

    const block = this.friendRepository.create({
      requesterId: userId,
      addresseeId: targetUserId,
      status: 'blocked'
    });

    return this.friendRepository.save(block);
  }

  async unblockUser(userId: string, targetUserId: string): Promise<void> {
    const block = await this.friendRepository.findOne({
      where: { requesterId: userId, addresseeId: targetUserId, status: 'blocked' }
    });

    if (!block) {
      throw new NotFoundException('User is not blocked');
    }

    await this.friendRepository.remove(block);
  }

  async getFriends(userId: string, status: FriendStatus = 'accepted'): Promise<Friend[]> {
    return this.friendRepository.find({
      where: [
        { requesterId: userId, status },
        { addresseeId: userId, status }
      ],
      relations: ['requester', 'addressee'],
      order: { createdAt: 'DESC' }
    });
  }

  async getFriendRequests(userId: string, type: 'sent' | 'received' = 'received'): Promise<Friend[]> {
    const where: FindOptionsWhere<Friend> = { status: 'pending' };
    
    if (type === 'sent') {
      where.requesterId = userId;
    } else {
      where.addresseeId = userId;
    }

    return this.friendRepository.find({
      where,
      relations: ['requester', 'addressee'],
      order: { createdAt: 'DESC' }
    });
  }

  async getFriendshipStatus(userId: string, targetUserId: string): Promise<{
    status: FriendStatus | null;
    isRequester: boolean;
  }> {
    const friendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: userId }
      ]
    });

    if (!friendship) {
      return { status: null, isRequester: false };
    }

    return {
      status: friendship.status,
      isRequester: friendship.requesterId === userId
    };
  }

  async searchUsers(query: string, userId: string, limit: number = 20): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id != :userId', { userId })
      .andWhere('(user.username ILIKE :query OR user.firstName ILIKE :query OR user.lastName ILIKE :query)', {
        query: `%${query}%`
      })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .limit(limit)
      .getMany();
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.friendRepository.find({
      where: [
        { requesterId: userId, status: 'accepted' },
        { addresseeId: userId, status: 'accepted' }
      ]
    });

    return friendships.map(friendship => 
      friendship.requesterId === userId 
        ? friendship.addresseeId 
        : friendship.requesterId
    );
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId1, addresseeId: userId2, status: 'accepted' },
        { requesterId: userId2, addresseeId: userId1, status: 'accepted' }
      ]
    });

    return !!friendship;
  }
}
