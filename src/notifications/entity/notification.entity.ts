import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { Book } from '../../books/entity/book.entity';
import { Application } from '../../applications/entity/application.entity';

export type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'application_approved'
  | 'application_rejected'
  | 'review_deadline_reminder'
  | 'author_book_published';

@Entity({ name: 'notifications' })
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: [
      'friend_request_received',
      'friend_request_accepted',
      'application_approved',
      'application_rejected',
      'review_deadline_reminder',
      'author_book_published',
    ],
    nullable: false,
  })
  type!: NotificationType;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ name: 'body', type: 'text', nullable: false })
  body!: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamp with time zone', nullable: true })
  readAt?: Date | null;

  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data?: {
    bookId?: string;
    applicationId?: string;
    friendId?: string;
    authorId?: string;
    daysUntilDeadline?: number;
    [key: string]: any;
  } | null;

  @ManyToOne(() => Book, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'book_id' })
  book?: Book | null;

  @Column({ name: 'book_id', type: 'uuid', nullable: true })
  bookId?: string | null;

  @ManyToOne(() => Application, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'application_id' })
  application?: Application | null;

  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'related_user_id' })
  relatedUser?: User | null;

  @Column({ name: 'related_user_id', type: 'uuid', nullable: true })
  relatedUserId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}

