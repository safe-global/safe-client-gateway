import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpaceNamesConstraint1743412080544 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        UPDATE spaces SET name = LEFT(name, 30) WHERE LENGTH(name) > 30;
        UPDATE members SET name = LEFT(name, 30) WHERE LENGTH(name) > 30;
        ALTER TABLE spaces ALTER COLUMN name TYPE VARCHAR(30);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        UPDATE spaces SET name = LEFT(name, 255) WHERE LENGTH(name) > 255;
        UPDATE members SET name = LEFT(name, 255) WHERE LENGTH(name) > 255;
        ALTER TABLE spaces ALTER COLUMN name TYPE VARCHAR(255);
    `);
  }
}
