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

@Entity({ name: 'device_tokens' })
@Index(['userId', 'token'], { unique: true })
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'token', type: 'text', nullable: false })
  token!: string;

  @Column({ name: 'device_type', type: 'varchar', length: 50, nullable: true })
  deviceType?: string | null;

  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  deviceId?: string | null;

  @Column({ name: 'app_version', type: 'varchar', length: 50, nullable: true })
  appVersion?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}

