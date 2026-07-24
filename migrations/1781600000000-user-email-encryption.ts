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
 *   non-deterministic value cannot be unique) for backfilled rows, plus a
 *   partial unique index on plaintext `email` for rows not yet backfilled —
 *   field encryption is disabled by default, so every row starts (and may
 *   stay, in an environment that never enables it) in that state, and
 *   uniqueness must keep holding there too.
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
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email") WHERE "email_index" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }]: Array<{ count: number }> = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "users" WHERE "email" LIKE 'kms:%'`,
    );
    if (count > 0) {
      throw new Error(
        `Cannot roll back: ${count} user(s) still hold encrypted ("kms:"-prefixed) ` +
          'email values, which will not fit the narrowed column/CHECK constraint. ' +
          'Decrypt them back to plaintext (reverse backfill) before reverting this migration.',
      );
    }

    await queryRunner.query(`DROP INDEX "idx_users_email_index"`);
    await queryRunner.query(`DROP INDEX "idx_users_email"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_index"`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" TYPE character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" IS NULL OR "email" = lower("email"))`,
    );
  }
}
