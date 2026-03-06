import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationData1772824079458 implements MigrationInterface {
    name = 'NotificationData1772824079458'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_reports" DROP CONSTRAINT "FK_user_reports_reported_by"`);
        await queryRunner.query(`ALTER TABLE "user_reports" DROP CONSTRAINT "FK_user_reports_reported_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_reviews_application_id_unique"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_reports_reported_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_reports_reported_by"`);
        await queryRunner.query(`ALTER TABLE "user_reports" ADD "reportedUserId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_reports" ADD "reportedById" uuid NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."user_reports_reason_enum" RENAME TO "user_reports_reason_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."user_reports_reason_enum" AS ENUM('spam', 'abuse', 'inappropriate_content', 'no_copy_sent', 'no_review_submitted', 'other')`);
        await queryRunner.query(`ALTER TABLE "user_reports" ALTER COLUMN "reason" TYPE "public"."user_reports_reason_enum" USING "reason"::"text"::"public"."user_reports_reason_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_reports_reason_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."friends_status_enum" RENAME TO "friends_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."friends_status_enum" AS ENUM('pending', 'accepted')`);
        await queryRunner.query(`ALTER TABLE "friends" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "friends" ALTER COLUMN "status" TYPE "public"."friends_status_enum" USING "status"::"text"::"public"."friends_status_enum"`);
        await queryRunner.query(`ALTER TABLE "friends" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."friends_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "user_reports" ADD CONSTRAINT "FK_85aa921a0dfd2b7d58cd4cd9450" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_reports" ADD CONSTRAINT "FK_2c9532744742e9b0cd7e71a3d5f" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_reports" DROP CONSTRAINT "FK_2c9532744742e9b0cd7e71a3d5f"`);
        await queryRunner.query(`ALTER TABLE "user_reports" DROP CONSTRAINT "FK_85aa921a0dfd2b7d58cd4cd9450"`);
        await queryRunner.query(`CREATE TYPE "public"."friends_status_enum_old" AS ENUM('pending', 'accepted', 'blocked')`);
        await queryRunner.query(`ALTER TABLE "friends" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "friends" ALTER COLUMN "status" TYPE "public"."friends_status_enum_old" USING "status"::"text"::"public"."friends_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "friends" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."friends_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."friends_status_enum_old" RENAME TO "friends_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."user_reports_reason_enum_old" AS ENUM('spam', 'abuse', 'inappropriate_content', 'no_copy_sent', 'no_review_sent', 'other')`);
        await queryRunner.query(`ALTER TABLE "user_reports" ALTER COLUMN "reason" TYPE "public"."user_reports_reason_enum_old" USING "reason"::"text"::"public"."user_reports_reason_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."user_reports_reason_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."user_reports_reason_enum_old" RENAME TO "user_reports_reason_enum"`);
        await queryRunner.query(`ALTER TABLE "user_reports" DROP COLUMN "reportedById"`);
        await queryRunner.query(`ALTER TABLE "user_reports" DROP COLUMN "reportedUserId"`);
        await queryRunner.query(`CREATE INDEX "IDX_user_reports_reported_by" ON "user_reports" ("reported_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_reports_reported_user" ON "user_reports" ("reported_user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_reviews_application_id_unique" ON "reviews" ("application_id") `);
        await queryRunner.query(`ALTER TABLE "user_reports" ADD CONSTRAINT "FK_user_reports_reported_user" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_reports" ADD CONSTRAINT "FK_user_reports_reported_by" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
