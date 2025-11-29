import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileHandling1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const booksTable = await queryRunner.getTable('books');
    if (booksTable) {
      const hasFileUrl = booksTable.findColumnByName('file_url');
      const hasFileSize = booksTable.findColumnByName('file_size');
      const hasFileType = booksTable.findColumnByName('file_type');

      if (!hasFileUrl) {
        await queryRunner.query(`
          ALTER TABLE books 
          ADD COLUMN file_url VARCHAR(500) NULL
        `);
      }

      if (!hasFileSize) {
        await queryRunner.query(`
          ALTER TABLE books 
          ADD COLUMN file_size BIGINT NULL
        `);
      }

      if (!hasFileType) {
        await queryRunner.query(`
          ALTER TABLE books 
          ADD COLUMN file_type VARCHAR(10) NULL
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
  }
}

