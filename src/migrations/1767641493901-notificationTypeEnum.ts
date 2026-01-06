import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationTypeEnum1767641493901 implements MigrationInterface {
    name = 'NotificationTypeEnum1767641493901'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN "notification_preferences"`);
        await queryRunner.query(`CREATE TYPE "public"."user_profiles_notification_preferences_enum" AS ENUM('friend_request_received', 'friend_request_accepted', 'friend_request_declined', 'application_approved', 'application_rejected', 'review_deadline_reminder', 'author_book_published')`);
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD "notification_preferences" "public"."user_profiles_notification_preferences_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN "notification_preferences"`);
        await queryRunner.query(`DROP TYPE "public"."user_profiles_notification_preferences_enum"`);
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD "notification_preferences" jsonb`);
    }

}
