import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export type PrivacyLevel = 'public' | 'friends' | 'private';

@Entity({ name: 'user_profiles' })
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ name: 'social_media', type: 'jsonb', nullable: true })
  socialMedia?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    goodreads?: string;
    custom?: Array<{
      platform: string;
      url: string;
    }>;
  } | null;

  @Column({ name: 'activity_privacy', type: 'enum', enum: ['public', 'friends', 'private'], default: 'friends' })
  activityPrivacy!: PrivacyLevel;

  @Column({ name: 'profile_privacy', type: 'enum', enum: ['public', 'friends', 'private'], default: 'friends' })
  profilePrivacy!: PrivacyLevel;

  @Column({ name: 'reading_list_privacy', type: 'enum', enum: ['public', 'friends', 'private'], default: 'friends' })
  readingListPrivacy!: PrivacyLevel;

  @Column({ name: 'reviews_privacy', type: 'enum', enum: ['public', 'friends', 'private'], default: 'public' })
  reviewsPrivacy!: PrivacyLevel;

  @Column({ name: 'notifications_enabled', type: 'boolean', default: true })
  notificationsEnabled!: boolean;

  @Column({ name: 'email_notifications', type: 'boolean', default: true })
  emailNotifications!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
