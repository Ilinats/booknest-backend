import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddBooksAndApplications1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'series',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'author_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
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
      'series',
      new TableIndex({ name: 'IDX_series_author_id', columnNames: ['author_id'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'books',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'author_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'short_description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'full_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cover_image_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'page_count',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'age_rating',
            type: 'enum',
            enum: ['all', '13+', '16+', '18+'],
            default: "'all'",
          },
          {
            name: 'distribution_type',
            type: 'enum',
            enum: ['physical', 'digital', 'both'],
            isNullable: false,
          },
          {
            name: 'file_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'file_size',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'file_type',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'total_copies',
            type: 'int',
            default: 1,
          },
          {
            name: 'available_copies',
            type: 'int',
            default: 1,
          },
          {
            name: 'application_deadline',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'review_deadline_days',
            type: 'int',
            default: 30,
          },
          {
            name: 'selection_criteria',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'selection_method',
            type: 'enum',
            enum: ['author_selects', 'first_come', 'lottery'],
            default: "'author_selects'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'active', 'in_progress', 'completed', 'archived'],
            default: "'draft'",
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
          {
            name: 'published_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'series_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'series_order',
            type: 'int',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'books',
      new TableIndex({ name: 'IDX_books_author_id', columnNames: ['author_id'] }),
    );

    await queryRunner.createForeignKey(
      'books',
      new TableForeignKey({
        columnNames: ['author_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'books',
      new TableForeignKey({
        columnNames: ['series_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'series',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'applications',
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
            name: 'reader_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected', 'withdrawn'],
            default: "'pending'",
          },
          {
            name: 'application_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'author_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'applied_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'responded_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'copy_sent_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'copy_received_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'review_submitted_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'reading_status',
            type: 'enum',
            enum: ['not_started', 'currently_reading', 'for_review', 'reviewed'],
            default: "'not_started'",
          },
          {
            name: 'reading_started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'reading_completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'responded_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'applications',
      new TableIndex({ name: 'IDX_applications_book_reader', columnNames: ['book_id', 'reader_id'], isUnique: true }),
    );
    await queryRunner.createIndex(
      'applications',
      new TableIndex({ name: 'IDX_applications_book_id', columnNames: ['book_id'] }),
    );
    await queryRunner.createIndex(
      'applications',
      new TableIndex({ name: 'IDX_applications_reader_id', columnNames: ['reader_id'] }),
    );
    await queryRunner.createIndex(
      'applications',
      new TableIndex({ name: 'IDX_applications_status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'applications',
      new TableIndex({ name: 'IDX_applications_reading_status', columnNames: ['reading_status'] }),
    );

    await queryRunner.createForeignKey(
      'applications',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'applications',
      new TableForeignKey({
        columnNames: ['reader_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'applications',
      new TableForeignKey({
        columnNames: ['responded_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('applications', true);
    await queryRunner.dropTable('books', true);
    await queryRunner.dropTable('series', true);
  }
}

