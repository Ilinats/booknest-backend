import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { getTypeOrmBaseConfig } from './typeorm.config';

config();

export default new DataSource(getTypeOrmBaseConfig());
