import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Book } from '../../books/entity/book.entity';
import { User } from '../../users/entity/user.entity';
import { Review } from '../../reviews/entity/review.entity';
import { ApplicationStatus, ReadingStatus } from '../enums';

@Entity({ name: 'applications' })
@Index(['bookId', 'readerId'], { unique: true })
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'book_id' })
  book!: Book;

  @Index()
  @Column({ name: 'book_id', type: 'uuid' })
  bookId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'reader_id' })
  reader!: User;

  @Index()
  @Column({ name: 'reader_id', type: 'uuid' })
  readerId!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status!: ApplicationStatus;

  @Column({ name: 'application_message', type: 'text', nullable: true })
  applicationMessage?: string | null;

  @Column({ name: 'author_notes', type: 'text', nullable: true })
  authorNotes?: string | null;

  @CreateDateColumn({ name: 'applied_at', type: 'timestamp with time zone' })
  appliedAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt?: Date | null;

  @Column({ name: 'copy_sent_at', type: 'timestamp', nullable: true })
  copySentAt?: Date | null;

  @Column({ name: 'copy_received_at', type: 'timestamp', nullable: true })
  copyReceivedAt?: Date | null;

  @Column({ name: 'review_submitted_at', type: 'timestamp', nullable: true })
  reviewSubmittedAt?: Date | null;

  @Index()
  @Column({
    name: 'reading_status',
    type: 'enum',
    enum: ReadingStatus,
    default: ReadingStatus.NOT_STARTED,
  })
  readingStatus!: ReadingStatus;

  @Column({ name: 'reading_started_at', type: 'timestamp', nullable: true })
  readingStartedAt?: Date | null;

  @Column({ name: 'reading_completed_at', type: 'timestamp', nullable: true })
  readingCompletedAt?: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'responded_by' })
  respondedBy?: User | null;

  @Column({ name: 'responded_by', type: 'uuid', nullable: true })
  respondedById?: string | null;

  @OneToOne(() => Review, (review) => review.application)
  review?: Review | null;
}
