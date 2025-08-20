import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMemberAlias1749755837793 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
                  ALTER TABLE members ADD COLUMN alias VARCHAR(30);
                `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
                  ALTER TABLE members DROP COLUMN alias;
                `);
  }
}
