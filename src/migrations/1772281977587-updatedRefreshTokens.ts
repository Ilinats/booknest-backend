import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatedRefreshTokens1772281977587 implements MigrationInterface {
    name = 'UpdatedRefreshTokens1772281977587'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_refresh_tokens" DROP CONSTRAINT "FK_f795ad14f31838e3ddc663ee150"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_044c20745eff448cbd0738cc4e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95e0bce05491b0dee2f28ffd11"`);
        await queryRunner.query(`ALTER TABLE "auth_refresh_tokens" DROP COLUMN "revoked_at"`);
        await queryRunner.query(`ALTER TABLE "auth_refresh_tokens" DROP COLUMN "replaced_by_token_id"`);
        await queryRunner.query(`ALTER TABLE "auth_refresh_tokens" DROP COLUMN "family_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_95e0bce05491b0dee2f28ffd11" ON "auth_refresh_tokens" ("token_hash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_95e0bce05491b0dee2f28ffd11"`);
        await queryRunner.query(`ALTER TABLE "auth_refresh_tokens" ADD "family_id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "auth_refresh_tokens" ADD "replaced_by_token_id" uuid`);
        await queryRunner.query(`ALTER TABLE "auth_refresh_tokens" ADD "revoked_at" TIMESTAMP`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_95e0bce05491b0dee2f28ffd11" ON "auth_refresh_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_044c20745eff448cbd0738cc4e" ON "auth_refresh_tokens" ("family_id") `);
        await queryRunner.query(`ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "FK_f795ad14f31838e3ddc663ee150" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
