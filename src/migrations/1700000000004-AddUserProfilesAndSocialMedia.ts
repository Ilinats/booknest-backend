import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddUserProfilesAndSocialMedia1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_profiles',
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
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'social_media',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'activity_privacy',
            type: 'enum',
            enum: ['public', 'friends', 'private'],
            default: "'friends'",
          },
          {
            name: 'profile_privacy',
            type: 'enum',
            enum: ['public', 'friends', 'private'],
            default: "'friends'",
          },
          {
            name: 'reading_list_privacy',
            type: 'enum',
            enum: ['public', 'friends', 'private'],
            default: "'friends'",
          },
          {
            name: 'reviews_privacy',
            type: 'enum',
            enum: ['public', 'friends', 'private'],
            default: "'public'",
          },
          {
            name: 'notifications_enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'email_notifications',
            type: 'boolean',
            default: true,
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

    await queryRunner.createForeignKey(
      'user_profiles',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_activities',
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
            name: 'activity_type',
            type: 'enum',
            enum: [
              'book_applied',
              'book_approved',
              'book_rejected',
              'review_posted',
              'book_started',
              'book_completed',
              'book_published',
              'profile_updated',
            ],
            isNullable: false,
          },
          {
            name: 'book_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'application_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
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
      'user_activities',
      new TableIndex({ name: 'IDX_user_activities_user_created', columnNames: ['user_id', 'created_at'] }),
    );

    await queryRunner.createForeignKey(
      'user_activities',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_activities',
      new TableForeignKey({
        columnNames: ['book_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'books',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_activities',
      new TableForeignKey({
        columnNames: ['application_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'applications',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_activities', true);
    await queryRunner.dropTable('user_profiles', true);
  }
}

