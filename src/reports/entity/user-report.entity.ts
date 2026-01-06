import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { ReportReason } from '../enums/report-reasons.enum';

@Entity({ name: 'user_reports' })
export class UserReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  reportedUser!: User;

  @Column({ name: 'reported_user_id', type: 'uuid' })
  reportedUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  reportedBy!: User;

  @Column({ name: 'reported_by_id', type: 'uuid' })
  reportedById!: string;

  @Column({ name: 'reason', type: 'enum', enum: ReportReason })
  reason!: ReportReason;

  @Column({ name: 'message', type: 'text', nullable: true })
  message?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
