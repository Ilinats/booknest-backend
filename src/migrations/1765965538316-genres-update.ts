import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnumsUpdate1765965538316 implements MigrationInterface {
  name = 'EnumsUpdate1765965538316';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "genres" DROP COLUMN "is_active"`);
    await queryRunner.query(`ALTER TABLE "genres" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "genres" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "genres" DROP COLUMN "color_code"`);
    await queryRunner.query(`ALTER TABLE "genres" DROP COLUMN "icon"`);
    await queryRunner.query(
      `ALTER TABLE "user_activities" ALTER COLUMN "activity_type" SET DEFAULT 'book_applied'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_reports_reason_enum" AS ENUM('spam', 'abuse', 'inappropriate_content', 'no_copy_sent', 'no_review_sent', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reported_user_id" uuid NOT NULL, "reported_by_id" uuid NOT NULL, "reason" "public"."user_reports_reason_enum" NOT NULL, "message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f2cf575f2f0a14b1ef5e81a0bba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_reports_reported_user" ON "user_reports" ("reported_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_reports_reported_by" ON "user_reports" ("reported_by_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_reports" ADD CONSTRAINT "FK_user_reports_reported_user" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_reports" ADD CONSTRAINT "FK_user_reports_reported_by" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_reports" DROP CONSTRAINT "FK_user_reports_reported_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_reports" DROP CONSTRAINT "FK_user_reports_reported_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_reports_reported_by"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_reports_reported_user"`,
    );
    await queryRunner.query(`DROP TABLE "user_reports"`);
    await queryRunner.query(`DROP TYPE "public"."user_reports_reason_enum"`);
    await queryRunner.query(
      `ALTER TABLE "user_activities" ALTER COLUMN "activity_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "genres" ADD "icon" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "genres" ADD "color_code" character varying(7)`,
    );
    await queryRunner.query(`ALTER TABLE "genres" ADD "description" text`);
    await queryRunner.query(
      `ALTER TABLE "genres" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "genres" ADD "is_active" boolean NOT NULL DEFAULT true`,
    );
  }
}
