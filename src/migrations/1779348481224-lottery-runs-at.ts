import { MigrationInterface, QueryRunner } from "typeorm";

export class LotteryRunsAt1779348481224 implements MigrationInterface {
    name = 'LotteryRunsAt1779348481224'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "books" ADD "lottery_run_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "lottery_run_at"`);
    }

}
