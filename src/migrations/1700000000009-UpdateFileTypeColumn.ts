import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateFileTypeColumn1700000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const booksTable = await queryRunner.getTable('books');
    if (booksTable) {
      const fileTypeColumn = booksTable.findColumnByName('file_type');
      if (fileTypeColumn) {
        await queryRunner.query(`
          ALTER TABLE books 
          ALTER COLUMN file_type TYPE VARCHAR(100)
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const booksTable = await queryRunner.getTable('books');
    if (booksTable) {
      const fileTypeColumn = booksTable.findColumnByName('file_type');
      if (fileTypeColumn) {
        await queryRunner.query(`
          ALTER TABLE books 
          ALTER COLUMN file_type TYPE VARCHAR(10)
        `);
      }
    }
  }
}

