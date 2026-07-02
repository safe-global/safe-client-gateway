// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prepares users.email for per-user field-level encryption with a blind index.
 *
 * - Widens `email` to `text` to hold ciphertext.
 * - Drops the lowercase CHECK constraint: ciphertext is not lowercase. The
 *   lowercase invariant is preserved by EmailAddressSchema (`.toLowerCase()`)
 *   before values reach the database.
 * - Adds `email_index`: an app-wide HMAC blind index over the normalised email,
 *   so uniqueness and equality lookups keep working now that the value is
 *   encrypted non-deterministically.
 * - Replaces the unique index on `email` with one on `email_index` (a
 *   non-deterministic value cannot be unique).
 */
export class UserEmailEncryption1781600000000 implements MigrationInterface {
  name = 'UserEmailEncryption1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "users_email_lowercase_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" TYPE text`,
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
    // Narrowing back will fail if encrypted values remain (they exceed the old
    // length and are not lowercase) — encryption must be backfilled-out first.
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" TYPE character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" IS NULL OR "email" = lower("email"))`,
    );
  }
}
