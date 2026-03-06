import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRefreshTokenTrackingFields1767637357480 implements MigrationInterface {
  name = 'RemoveRefreshTokenTrackingFields1767637357480';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" DROP COLUMN "ip"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" DROP COLUMN "user_agent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" DROP COLUMN "device_name"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" ADD "device_name" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" ADD "user_agent" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" ADD "ip" character varying(100)`,
    );
  }
}
