import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';

@Entity({ name: 'author_follows' })
@Index(['followerId', 'authorId'], { unique: true })
export class AuthorFollow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'follower_id', type: 'uuid' })
  followerId!: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower?: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: User;
}
