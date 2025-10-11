import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Book } from '../../books/entity/book.entity';
import { User } from '../../users/entity/user.entity';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type ReadingStatus = 'not_started' | 'currently_reading' | 'for_review' | 'reviewed';

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
  @Column({ name: 'status', type: 'enum', enum: ['pending', 'approved', 'rejected', 'withdrawn'], default: 'pending' })
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
  @Column({ name: 'reading_status', type: 'enum', enum: ['not_started', 'currently_reading', 'for_review', 'reviewed'], default: 'not_started' })
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
}
