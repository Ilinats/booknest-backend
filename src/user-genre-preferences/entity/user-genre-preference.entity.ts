import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { Genre } from '../../genres/entity/genre.entity';

@Entity({ name: 'user_genre_preferences' })
@Unique(['user', 'genre'])
export class UserGenrePreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Genre, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'genre_id' })
  genre!: Genre;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
