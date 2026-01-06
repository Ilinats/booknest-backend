import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserGenrePreference } from '../../user-genre-preferences/entity/user-genre-preference.entity';

@Entity({ name: 'genres' })
@Unique(['name'])
export class Genre {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @OneToMany(() => UserGenrePreference, (pref) => pref.genre)
  preferences?: UserGenrePreference[];
}
