// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prepares users.email for deterministic field-level encryption.
 *
 * - Widens `email` to `text` to hold ciphertext.
 * - Drops the lowercase CHECK constraint: ciphertext is not lowercase. The
 *   lowercase invariant is preserved by EmailAddressSchema (`.toLowerCase()`)
 *   before values reach the database.
 *
 * The unique partial index `idx_users_email` is intentionally kept: deterministic
 * encryption maps identical emails to identical ciphertext, so uniqueness and
 * equality lookups continue to work. Postgres rebuilds the index automatically
 * when the column type changes.
 */
export class UserEmailFieldEncryption1781600000000
  implements MigrationInterface
{
  name = 'UserEmailFieldEncryption1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "users_email_lowercase_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
