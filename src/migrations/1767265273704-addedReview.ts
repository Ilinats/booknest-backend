import { MigrationInterface, QueryRunner } from "typeorm";

export class AddedReview1767265273704 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_reviews_application_id_unique" ON "reviews" ("application_id")`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX IF EXISTS "IDX_reviews_application_id_unique"`
        );
    }

}
