// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prepares the columns that hold human-entered labels for field-level
 * encryption.
 *
 * - Widens the encrypted columns to `text`: AES-256-GCM ciphertext is longer
 *   than the plaintext length limits (and is base64url-encoded with a prefix),
 *   so the existing varchar bounds no longer apply. Plaintext length is still
 *   validated in the Zod schemas before encryption.
 * - Drops `idx_members_name`: randomized ciphertext makes an equality/B-tree
 *   index on the encrypted value useless.
 */
export class SpacesFieldEncryptionColumns1781500000000
  implements MigrationInterface
{
  name = 'SpacesFieldEncryptionColumns1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_members_name"`);
    await queryRunner.query(
      `ALTER TABLE "spaces" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "alias" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "address_book_requests" ALTER COLUMN "name" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting narrows the columns back to their original varchar bounds. This
    // will fail if any encrypted (ciphertext) values remain, since they exceed
    // the original lengths — encryption must be backfilled-out first.
    await queryRunner.query(
      `ALTER TABLE "address_book_requests" ALTER COLUMN "name" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "alias" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "spaces" ALTER COLUMN "name" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_members_name" ON "members" ("name")`,
    );
  }
}
