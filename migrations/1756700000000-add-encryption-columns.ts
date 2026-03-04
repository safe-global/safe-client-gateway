// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEncryptionColumns1756700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Widen columns to TEXT for encrypted ciphertext
    await queryRunner.query(
      `ALTER TABLE "wallets" ALTER COLUMN "address" TYPE TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_safes" ALTER COLUMN "address" TYPE TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE TEXT`,
    );

    // Add address_hash columns (IF NOT EXISTS for idempotency)
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "address_hash" VARCHAR(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_safes" ADD COLUMN IF NOT EXISTS "address_hash" VARCHAR(64)`,
    );

    // Create indexes on address_hash
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallets_address_hash" ON "wallets" ("address_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_SS_address_hash" ON "space_safes" ("address_hash")`,
    );

    // Drop old unique constraints/indexes (ciphertext is non-deterministic)
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "UQ_wallet_address"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_wallet_address"`);
    await queryRunner.query(
      `ALTER TABLE "space_safes" DROP CONSTRAINT IF EXISTS "UQ_SS_chainId_address_space"`,
    );
    // The index was created unquoted (stored as lowercase in PG)
    await queryRunner.query(`DROP INDEX IF EXISTS uq_ss_chainid_address_space`);

    // Partial unique indexes for migrated rows (NULL allowed for unmigrated)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wallets_address_hash" ON "wallets" ("address_hash") WHERE "address_hash" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_SS_chainId_addressHash_space" ON "space_safes" ("chain_id", "address_hash", "space_id") WHERE "address_hash" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop partial unique indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_SS_chainId_addressHash_space"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_wallets_address_hash"`);

    // Restore original unique constraints
    await queryRunner.query(
      `ALTER TABLE "space_safes" ADD CONSTRAINT "UQ_SS_chainId_address_space" UNIQUE ("chain_id", "address", "space_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "UQ_wallet_address" UNIQUE ("address")`,
    );

    // Drop address_hash indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_SS_address_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wallets_address_hash"`);

    // Drop address_hash columns
    await queryRunner.query(
      `ALTER TABLE "space_safes" DROP COLUMN IF EXISTS "address_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP COLUMN IF EXISTS "address_hash"`,
    );

    // Restore original column types
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE VARCHAR(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE VARCHAR(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_safes" ALTER COLUMN "address" TYPE VARCHAR(42)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ALTER COLUMN "address" TYPE VARCHAR(42)`,
    );
  }
}
