import { ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleOptions,
  TypeOrmModuleAsyncOptions,
} from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

export function getTypeOrmBaseConfig(): DataSourceOptions {
  const isTsNode =
    process.env.TS_NODE === 'true' || process.env.TS_NODE_DEV === 'true';

  return {
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    entities: [isTsNode ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'],
    migrations: [isTsNode ? 'src/migrations/*.ts' : 'dist/migrations/*.js'],
    migrationsTableName: 'migrations',
    synchronize: false,
    logging: process.env.DATABASE_LOGGING === 'true',
  };
}

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  useFactory: async (
    configService: ConfigService,
  ): Promise<TypeOrmModuleOptions> => {
    const baseConfig = getTypeOrmBaseConfig();
    const postgresConfig = baseConfig as DataSourceOptions & {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
    };
    const config = {
      ...baseConfig,
      autoLoadEntities: true,
      host: configService.get<string>('POSTGRES_HOST') || postgresConfig.host,
      port: configService.get<number>('POSTGRES_PORT') || postgresConfig.port,
      username:
        configService.get<string>('POSTGRES_USER') || postgresConfig.username,
      password:
        configService.get<string>('POSTGRES_PASSWORD') ||
        postgresConfig.password,
      database:
        configService.get<string>('POSTGRES_DB') ||
        (typeof postgresConfig.database === 'string'
          ? postgresConfig.database
          : undefined),
      logging:
        configService.get<string>('DATABASE_LOGGING') === 'true' ||
        baseConfig.logging,
    } as TypeOrmModuleOptions;
    return config;
  },
  inject: [ConfigService],
};
