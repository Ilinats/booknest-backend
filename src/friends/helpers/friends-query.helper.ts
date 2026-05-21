import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friend } from '../entity/friend.entity';
import { FriendStatus } from '../enums';
import { FriendErrorCode } from '../errors';

@Injectable()
export class FriendsQueryHelper {
  constructor(
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
  ) {}

  findExistingFriendship(
    requesterId: string,
    addresseeId: string,
  ): Promise<Friend | null> {
    return this.friendRepository.findOne({
      where: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    });
  }

  async findPendingRequestOrThrow(
    requesterId: string,
    addresseeId: string,
  ): Promise<Friend> {
    const friendRequest = await this.friendRepository.findOne({
      where: { requesterId, addresseeId, status: FriendStatus.PENDING },
    });

    if (!friendRequest) {
      throw new NotFoundException(FriendErrorCode.REQUEST_NOT_FOUND);
    }

    return friendRequest;
  }

  async findAcceptedFriendshipOrThrow(
    userId: string,
    friendId: string,
  ): Promise<Friend> {
    const friendship = await this.friendRepository.findOne({
      where: [
        {
          requesterId: userId,
          addresseeId: friendId,
          status: FriendStatus.ACCEPTED,
        },
        {
          requesterId: friendId,
          addresseeId: userId,
          status: FriendStatus.ACCEPTED,
        },
      ],
    });

    if (!friendship) {
      throw new NotFoundException(FriendErrorCode.FRIENDSHIP_NOT_FOUND);
    }

    return friendship;
  }

  findFriendshipBetween(
    userId: string,
    targetUserId: string,
  ): Promise<Friend | null> {
    return this.friendRepository.findOne({
      where: [
        { requesterId: userId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: userId },
      ],
    });
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.friendRepository.findOne({
      where: [
        {
          requesterId: userId1,
          addresseeId: userId2,
          status: FriendStatus.ACCEPTED,
        },
        {
          requesterId: userId2,
          addresseeId: userId1,
          status: FriendStatus.ACCEPTED,
        },
      ],
    });

    return friendship !== null;
  }

  findAcceptedFriendships(
    userId: string,
    relations: string[] = [],
  ): Promise<Friend[]> {
    return this.friendRepository.find({
      where: [
        { requesterId: userId, status: FriendStatus.ACCEPTED },
        { addresseeId: userId, status: FriendStatus.ACCEPTED },
      ],
      relations,
      order: { createdAt: 'DESC' },
    });
  }

  async getAcceptedFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.friendRepository.find({
      where: [
        { requesterId: userId, status: FriendStatus.ACCEPTED },
        { addresseeId: userId, status: FriendStatus.ACCEPTED },
      ],
    });

    return friendships.map((friendship) =>
      friendship.requesterId === userId
        ? friendship.addresseeId
        : friendship.requesterId,
    );
  }

  findFriendshipsForUsers(userId: string, userIds: string[]): Promise<Friend[]> {
    if (userIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.friendRepository
      .createQueryBuilder('friend')
      .where(
        '(friend.requesterId = :userId AND friend.addresseeId IN (:...userIds)) OR (friend.addresseeId = :userId AND friend.requesterId IN (:...userIds))',
        { userId, userIds },
      )
      .getMany();
  }
}
