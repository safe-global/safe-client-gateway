// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEmail1776200000000 implements MigrationInterface {
  name = 'AddUserEmail1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "email" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_key" ON "users" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_email_lower" ON "users" (LOWER("email"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_users_email_lower"`);
    await queryRunner.query(`DROP INDEX "users_email_key"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
  }
}
