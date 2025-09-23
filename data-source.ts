import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
config();

const isTsNode = process.env.TS_NODE === 'true' || process.env.TS_NODE_DEV === 'true';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [isTsNode ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});