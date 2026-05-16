import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { Series } from '../../series/entity/series.entity';
import { BookGenre } from './book-genre.entity';
import {
  AgeRating,
  DistributionType,
  SelectionMethod,
  BookStatus,
} from '../enums';

@Entity({ name: 'books' })
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @Index()
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({
    name: 'short_description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  shortDescription?: string | null;

  @Column({ name: 'full_description', type: 'text', nullable: true })
  fullDescription?: string | null;

  @Column({
    name: 'cover_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  coverImageUrl?: string | null;

  @Column({ name: 'page_count', type: 'int', nullable: true })
  pageCount?: number | null;

  @Column({
    name: 'age_rating',
    type: 'enum',
    enum: AgeRating,
    default: AgeRating.ALL,
  })
  ageRating!: AgeRating;

  @Column({ name: 'distribution_type', type: 'enum', enum: DistributionType })
  distributionType!: DistributionType;

  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl?: string | null;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize?: string | null;

  @Column({ name: 'file_type', type: 'varchar', length: 100, nullable: true })
  fileType?: string | null;

  @Column({ name: 'total_copies', type: 'int', default: 1 })
  totalCopies!: number;

  @Column({ name: 'available_copies', type: 'int', default: 1 })
  availableCopies!: number;

  @Column({ name: 'application_deadline', type: 'timestamp' })
  applicationDeadline!: Date;

  @Column({ name: 'review_deadline', type: 'timestamp', nullable: true })
  reviewDeadline?: Date | null;

  @Column({ name: 'selection_criteria', type: 'text', nullable: true })
  selectionCriteria?: string | null;

  @Column({
    name: 'selection_method',
    type: 'enum',
    enum: SelectionMethod,
    default: SelectionMethod.AUTHOR_SELECTS,
  })
  selectionMethod!: SelectionMethod;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BookStatus,
    default: BookStatus.DRAFT,
  })
  status!: BookStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt?: Date | null;

  @ManyToOne(() => Series, (series) => series.books, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'series_id' })
  series?: Series | null;

  @Column({ name: 'series_id', type: 'uuid', nullable: true })
  seriesId?: string | null;

  @Column({ name: 'series_order', type: 'int', nullable: true })
  seriesOrder?: number | null;

  @OneToMany(() => BookGenre, (bg) => bg.book)
  bookGenres?: BookGenre[];
}
