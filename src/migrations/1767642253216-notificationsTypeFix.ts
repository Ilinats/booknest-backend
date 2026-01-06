import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsTypeFix1767642253216 implements MigrationInterface {
  name = 'NotificationsTypeFix1767642253216';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_profiles" DROP COLUMN "notification_preferences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profiles" ADD "notification_preferences" "public"."user_profiles_notification_preferences_enum"[]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_profiles" DROP COLUMN "notification_preferences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profiles" ADD "notification_preferences" "public"."user_profiles_notification_preferences_enum"`,
    );
  }
}
