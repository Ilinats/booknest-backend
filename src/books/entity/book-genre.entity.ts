import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Book } from './book.entity';
import { Genre } from '../../genres/entity/genre.entity';

@Entity({ name: 'book_genres' })
@Index(['bookId', 'genreId'], { unique: true })
export class BookGenre {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'book_id' })
  book!: Book;

  @Column({ name: 'book_id', type: 'uuid' })
  bookId!: string;

  @ManyToOne(() => Genre, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'genre_id' })
  genre!: Genre;

  @Column({ name: 'genre_id', type: 'int' })
  genreId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}


