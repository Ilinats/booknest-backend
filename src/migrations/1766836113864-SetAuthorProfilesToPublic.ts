import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetAuthorProfilesToPublic1766836113864
  implements MigrationInterface
{
  name = 'SetAuthorProfilesToPublic1766836113864';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update all author profiles to be public
    await queryRunner.query(`
      UPDATE user_profiles
      SET profile_privacy = 'public'
      WHERE user_id IN (
        SELECT id FROM users WHERE user_type = 'author'
      )
      AND profile_privacy != 'public'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert author profiles back to friends (default)
    // Note: This doesn't preserve the original values, just sets them to friends
    await queryRunner.query(`
      UPDATE user_profiles
      SET profile_privacy = 'friends'
      WHERE user_id IN (
        SELECT id FROM users WHERE user_type = 'author'
      )
      AND profile_privacy = 'public'
    `);
  }
}
