import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMemberAlias1749755837793 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
                  ALTER TABLE members ADD COLUMN alias VARCHAR(255);
                  CREATE INDEX idx_members_alias ON members (alias);
                `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
                  DROP INDEX idx_members_alias;
                  ALTER TABLE members DROP COLUMN alias;
                `);
  }
}
