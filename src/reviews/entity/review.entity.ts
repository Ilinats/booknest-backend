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
import { Application } from '../../applications/entity/application.entity';
import { ReviewType } from '../enums';

@Entity({ name: 'reviews' })
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'application_id' })
  application!: Application;

  @Index()
  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @Column({ name: 'rating', type: 'decimal', precision: 3, scale: 2 })
  rating!: number;

  @Column({ name: 'review_type', type: 'enum', enum: ReviewType })
  reviewType: ReviewType;

  @Column({ name: 'review_content', type: 'text', nullable: true })
  reviewContent?: string | null;

  @Column({ name: 'review_urls', type: 'text', array: true, nullable: true })
  reviewUrls?: string[] | null;

  @Index()
  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic!: boolean;

  @Index()
  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ name: 'word_count', type: 'int', nullable: true })
  wordCount?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
