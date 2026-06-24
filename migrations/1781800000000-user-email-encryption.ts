// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prepares users.email for per-user encryption with a blind index.
 *
 * - Adds `encrypted_data_key`: the KMS-wrapped per-user data key that encrypts
 *   the email value.
 * - Adds `email_index`: an app-wide HMAC blind index over the normalised email,
 *   so uniqueness and equality lookups keep working now that the value is
 *   encrypted non-deterministically.
 * - Replaces the unique index on `email` with one on `email_index` (a
 *   non-deterministic value cannot be unique).
 */
export class UserEmailEncryption1781800000000 implements MigrationInterface {
  name = 'UserEmailEncryption1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "encrypted_data_key" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "email_index" text`,
    );
    await queryRunner.query(`DROP INDEX "idx_users_email"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_email_index" ON "users" ("email_index") WHERE "email_index" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_users_email_index"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_index"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "encrypted_data_key"`,
    );
  }
}
