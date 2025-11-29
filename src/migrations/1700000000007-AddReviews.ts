import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddReviews1700000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'reviews',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'application_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'rating',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'review_type',
            type: 'enum',
            enum: ['link', 'text'],
            isNullable: false,
          },
          {
            name: 'review_content',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'review_urls',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'is_public',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_featured',
            type: 'boolean',
            default: false,
          },
          {
            name: 'word_count',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'reviews',
      new TableIndex({ name: 'IDX_reviews_application_id', columnNames: ['application_id'] }),
    );
    await queryRunner.createIndex(
      'reviews',
      new TableIndex({ name: 'IDX_reviews_is_public', columnNames: ['is_public'] }),
    );
    await queryRunner.createIndex(
      'reviews',
      new TableIndex({ name: 'IDX_reviews_is_featured', columnNames: ['is_featured'] }),
    );

    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['application_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'applications',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reviews', true);
  }
}

