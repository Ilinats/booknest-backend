import { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicAccounts1767017723418 implements MigrationInterface {
  name = 'PublicAccounts1767017723418';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          UPDATE user_profiles
          SET activity_privacy = 'public'
          WHERE activity_privacy != 'public'
        `);

    await queryRunner.query(`
          UPDATE user_profiles
          SET profile_privacy = 'public'
          WHERE profile_privacy != 'public'
        `);

    await queryRunner.query(`
          ALTER TABLE user_profiles
          ALTER COLUMN activity_privacy SET DEFAULT 'public'
        `);

    await queryRunner.query(`
          ALTER TABLE user_profiles
          ALTER COLUMN profile_privacy SET DEFAULT 'public'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE user_profiles
          ALTER COLUMN activity_privacy SET DEFAULT 'friends'
        `);

    await queryRunner.query(`
          ALTER TABLE user_profiles
          ALTER COLUMN profile_privacy SET DEFAULT 'friends'
        `);
  }
}
