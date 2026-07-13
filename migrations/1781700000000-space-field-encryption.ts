// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Field-encryption expansion (see
 * docs/superpowers/specs/2026-07-10-space-field-encryption-expansion-design.md):
 *
 * - Widens every to-be-encrypted column to `text` (KMS ciphertext exceeds the
 *   varchar caps; plaintext length limits are enforced in the DTO schemas).
 * - Adds a nullable `address_index` blind-index column beside each unique
 *   address column.
 * - Splits each uniqueness constraint into a plaintext arm (plaintext rows
 *   when encryption is disabled: `address_index IS NULL`) and a blind-index
 *   arm, following the users.email precedent.
 * - Drops `idx_members_name`: nothing filters or orders by members.name, and
 *   a btree over ciphertext is meaningless.
 *
 * Purely structural: no data rewrite. The backfill script
 * (scripts/backfill-field-encryption.ts) encrypts existing rows afterwards.
 */
export class SpaceFieldEncryption1781700000000 implements MigrationInterface {
  name = 'SpaceFieldEncryption1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // wallets
    await queryRunner.query(
      `ALTER TABLE "wallets" ALTER COLUMN "address" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD COLUMN "address_index" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "UQ_wallet_address"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_wallet_address_plain" ON "wallets" ("address") WHERE "address_index" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_wallet_address_index" ON "wallets" ("address_index") WHERE "address_index" IS NOT NULL`,
    );

    // spaces
    await queryRunner.query(
      `ALTER TABLE "spaces" ALTER COLUMN "name" TYPE text`,
    );

    // space_safes
    await queryRunner.query(
      `ALTER TABLE "space_safes" ALTER COLUMN "address" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_safes" ADD COLUMN "address_index" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_safes" DROP CONSTRAINT "UQ_SS_chainId_address_space"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_SS_chainId_address_space_plain" ON "space_safes" ("chain_id", "address", "space_id") WHERE "address_index" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_SS_chainId_addressIndex_space" ON "space_safes" ("chain_id", "address_index", "space_id") WHERE "address_index" IS NOT NULL`,
    );

    // space_address_book_items
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "address" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ADD COLUMN "address_index" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" DROP CONSTRAINT "UQ_SABI_space_id_address"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_SABI_space_id_address_plain" ON "space_address_book_items" ("space_id", "address") WHERE "address_index" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_SABI_space_id_address_index" ON "space_address_book_items" ("space_id", "address_index") WHERE "address_index" IS NOT NULL`,
    );

    // address_book_requests
    await queryRunner.query(
      `ALTER TABLE "address_book_requests" ALTER COLUMN "address" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "address_book_requests" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "address_book_requests" ADD COLUMN "address_index" text`,
    );
    await queryRunner.query(
      `DROP INDEX "UQ_ABR_space_requester_address_pending"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ABR_space_requester_address_pending_plain" ON "address_book_requests" ("space_id", "requested_by", "address") WHERE "status" = 0 AND "address_index" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ABR_space_requester_address_index_pending" ON "address_book_requests" ("space_id", "requested_by", "address_index") WHERE "status" = 0 AND "address_index" IS NOT NULL`,
    );

    // members
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "alias" TYPE text`,
    );
    await queryRunner.query(`DROP INDEX "idx_members_name"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse to narrow columns or restore plaintext constraints while any
    // encrypted value or blind index exists — reversing then would truncate
    // ciphertext and corrupt rows. Decrypt/clear the data first.
    const [{ count }] = await queryRunner.query(
      `SELECT (
         (SELECT COUNT(*) FROM "wallets" WHERE "address" LIKE 'kms:%' OR "address_index" IS NOT NULL)
       + (SELECT COUNT(*) FROM "spaces" WHERE "name" LIKE 'kms:%')
       + (SELECT COUNT(*) FROM "space_safes" WHERE "address" LIKE 'kms:%' OR "address_index" IS NOT NULL)
       + (SELECT COUNT(*) FROM "space_address_book_items" WHERE "address" LIKE 'kms:%' OR "name" LIKE 'kms:%' OR "address_index" IS NOT NULL)
       + (SELECT COUNT(*) FROM "address_book_requests" WHERE "address" LIKE 'kms:%' OR "name" LIKE 'kms:%' OR "address_index" IS NOT NULL)
       + (SELECT COUNT(*) FROM "members" WHERE "name" LIKE 'kms:%' OR "alias" LIKE 'kms:%')
       )::int AS count`,
    );
    if (Number(count) > 0) {
      throw new Error(
        `Cannot revert space-field-encryption: ${count} encrypted/indexed rows exist`,
      );
    }

    // members
    await queryRunner.query(
      `CREATE INDEX "idx_members_name" ON "members" ("name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "alias" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE character varying(255)`,
    );

    // address_book_requests
    await queryRunner.query(
      `DROP INDEX "UQ_ABR_space_requester_address_index_pending"`,
    );
    await queryRunner.query(
      `DROP INDEX "UQ_ABR_space_requester_address_pending_plain"`,
    );
    await queryRunner.query(
      `ALTER TABLE "address_book_requests" DROP COLUMN "address_index"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ABR_space_requester_address_pending" ON "address_book_requests" ("space_id", "requested_by", "address") WHERE "status" = 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "address_book_requests" ALTER COLUMN "name" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "address_book_requests" ALTER COLUMN "address" TYPE character varying(42)`,
    );

    // space_address_book_items
    await queryRunner.query(`DROP INDEX "UQ_SABI_space_id_address_index"`);
    await queryRunner.query(`DROP INDEX "UQ_SABI_space_id_address_plain"`);
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" DROP COLUMN "address_index"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ADD CONSTRAINT "UQ_SABI_space_id_address" UNIQUE ("space_id", "address")`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "address" TYPE character varying(42)`,
    );

    // space_safes
    await queryRunner.query(`DROP INDEX "UQ_SS_chainId_addressIndex_space"`);
    await queryRunner.query(`DROP INDEX "UQ_SS_chainId_address_space_plain"`);
    await queryRunner.query(
      `ALTER TABLE "space_safes" DROP COLUMN "address_index"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_safes" ADD CONSTRAINT "UQ_SS_chainId_address_space" UNIQUE ("chain_id", "address", "space_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_safes" ALTER COLUMN "address" TYPE character varying(42)`,
    );

    // spaces
    await queryRunner.query(
      `ALTER TABLE "spaces" ALTER COLUMN "name" TYPE character varying(30)`,
    );

    // wallets
    await queryRunner.query(`DROP INDEX "UQ_wallet_address_index"`);
    await queryRunner.query(`DROP INDEX "UQ_wallet_address_plain"`);
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP COLUMN "address_index"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "UQ_wallet_address" UNIQUE ("address")`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ALTER COLUMN "address" TYPE character varying(42)`,
    );
  }
}
