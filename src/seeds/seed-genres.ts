import { Genre } from '../genres/entity/genre.entity';
import { UserGenrePreference } from '../genres/entity/user-genre-preference.entity';
import { User } from '../users/entity/user.entity';
import { UserAddress } from '../users/entity/user-address.entity';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
config();

const genres = [
  'Fantasy',
  'Science Fiction',
  'Mystery',
  'Thriller',
  'Romance',
  'Horror',
  'Historical',
  'Young Adult',
  'Children',
  'Non-Fiction',
  'Biography',
  'Self-Help',
  'Graphic Novel',
  'Adventure',
  'Poetry',
];

async function seedGenres() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    entities: [Genre, UserGenrePreference, User, UserAddress],
    synchronize: true,
  });
  await ds.initialize();
  for (const name of genres) {
    const exists = await ds.getRepository(Genre).findOne({ where: { name } });
    if (!exists) {
      const genre = ds.getRepository(Genre).create({ name });
      await ds.getRepository(Genre).save(genre);
      console.log(`Inserted genre: ${name}`);
    } else {
      console.log(`Genre already exists: ${name}`);
    }
  }
  await ds.destroy();
  console.log('Seeding complete.');
}

seedGenres().catch((err) => {
  console.error('Error seeding genres:', err);
  process.exit(1);
});
