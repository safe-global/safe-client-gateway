// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpaceUuid1779200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE spaces
        ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX UQ_spaces_uuid ON spaces (uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX UQ_spaces_uuid;`);
    await queryRunner.query(`ALTER TABLE spaces DROP COLUMN uuid;`);
  }
}
