import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddGenresAndPreferences1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'genres',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'color_code',
            type: 'varchar',
            length: '7',
            isNullable: true,
          },
          {
            name: 'icon',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'genres',
      new TableIndex({ name: 'IDX_genres_name', columnNames: ['name'], isUnique: true }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'book_genres',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'book_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'genre_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'book_genres',
      new TableIndex({
        name: 'IDX_book_genres_book_genre',
        columnNames: ['book_id', 'genre_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'book_genres',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'book_genres',
      new TableForeignKey({
        columnNames: ['genre_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'genres',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_genre_preferences',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'genre_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'preference_level',
            type: 'int',
            default: 5,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'user_genre_preferences',
      new TableIndex({
        name: 'IDX_user_genre_prefs_user_genre',
        columnNames: ['user_id', 'genre_id'],
        isUnique: true,
      }),
    );

    await queryRunner.query(`
      ALTER TABLE user_genre_preferences 
      ADD CONSTRAINT CHK_preference_level 
      CHECK (preference_level >= 1 AND preference_level <= 5)
    `);

    await queryRunner.createForeignKey(
      'user_genre_preferences',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_genre_preferences',
      new TableForeignKey({
        columnNames: ['genre_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'genres',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_genre_preferences', true);
    await queryRunner.dropTable('book_genres', true);
    await queryRunner.dropTable('genres', true);
  }
}

