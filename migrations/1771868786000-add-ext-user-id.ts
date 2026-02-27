// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtUserId1771868786000 implements MigrationInterface {
  name = 'AddExtUserId1771868786000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "ext_user_id" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_ext_user_id" ON "users" ("ext_user_id") WHERE "ext_user_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_users_ext_user_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ext_user_id"`);
  }
}
