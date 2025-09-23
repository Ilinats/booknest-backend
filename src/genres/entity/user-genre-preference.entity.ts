import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { Genre } from './genre.entity';

@Entity({ name: 'user_genre_preferences' })
@Unique(['user', 'genre'])
@Check(`"preference_level" >= 1 AND "preference_level" <= 5`)
export class UserGenrePreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Genre, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'genre_id' })
  genre!: Genre;

  @Column({ name: 'preference_level', type: 'int', default: 5 })
  preferenceLevel!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}


