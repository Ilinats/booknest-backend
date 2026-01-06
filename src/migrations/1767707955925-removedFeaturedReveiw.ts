import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovedFeaturedReveiw1767707955925 implements MigrationInterface {
  name = 'RemovedFeaturedReveiw1767707955925';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a3f93b7e51709ce8e8ea1d4e68"`,
    );
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "is_featured"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD "is_featured" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a3f93b7e51709ce8e8ea1d4e68" ON "reviews" ("is_featured") `,
    );
  }
}
