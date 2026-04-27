// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddressBookAttributionToUserId1777033895000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verify all wallet addresses resolve to a user before altering columns.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM space_address_book_items sabi
          WHERE NOT EXISTS (
            SELECT 1 FROM wallets w WHERE w.address = sabi.created_by
          )
          OR NOT EXISTS (
            SELECT 1 FROM wallets w WHERE w.address = sabi.last_updated_by
          )
        ) THEN
          RAISE EXCEPTION
            'Unresolvable wallet addresses in space_address_book_items. '
            'Every created_by/last_updated_by must map to a wallets row.';
        END IF;
      END $$;
    `);

    // Add new integer columns for user ID attribution.
    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        ADD COLUMN created_by_uid integer,
        ADD COLUMN last_updated_by_uid integer;
    `);

    // Backfill: resolve wallet addresses to user IDs via the wallets table.
    await queryRunner.query(`
      UPDATE space_address_book_items sabi
      SET created_by_uid = w.user_id
      FROM wallets w
      WHERE w.address = sabi.created_by;
    `);

    await queryRunner.query(`
      UPDATE space_address_book_items sabi
      SET last_updated_by_uid = w.user_id
      FROM wallets w
      WHERE w.address = sabi.last_updated_by;
    `);

    // Verify backfill left no NULLs (e.g. case mismatch on address JOIN).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM space_address_book_items
          WHERE created_by_uid IS NULL
            OR last_updated_by_uid IS NULL
        ) THEN
          RAISE EXCEPTION
            'Backfill incomplete: some rows have NULL created_by_uid '
            'or last_updated_by_uid after wallet address resolution.';
        END IF;
      END $$;
    `);

    // Drop old varchar columns and rename new ones.
    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        DROP COLUMN created_by,
        DROP COLUMN last_updated_by;
    `);

    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        RENAME COLUMN created_by_uid TO created_by;
    `);

    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        RENAME COLUMN last_updated_by_uid TO last_updated_by;
    `);

    // Set NOT NULL constraint on the new columns.
    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        ALTER COLUMN created_by SET NOT NULL,
        ALTER COLUMN last_updated_by SET NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse is lossy: OIDC-created entries have no wallet to map back to,
    // and users with multiple wallets pick one arbitrarily (LIMIT 1).
    // Columns are intentionally left nullable (unlike the original NOT NULL)
    // because OIDC-created entries will have NULL after rollback.
    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        ADD COLUMN created_by_addr varchar(42),
        ADD COLUMN last_updated_by_addr varchar(42);
    `);

    // Best-effort backfill from user IDs to wallet addresses.
    await queryRunner.query(`
      UPDATE space_address_book_items sabi
      SET created_by_addr = (
        SELECT w.address FROM wallets w
        WHERE w.user_id = sabi.created_by LIMIT 1
      );
    `);

    await queryRunner.query(`
      UPDATE space_address_book_items sabi
      SET last_updated_by_addr = (
        SELECT w.address FROM wallets w
        WHERE w.user_id = sabi.last_updated_by LIMIT 1
      );
    `);

    // Drop integer columns and rename varchar ones.
    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        DROP COLUMN created_by,
        DROP COLUMN last_updated_by;
    `);

    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        RENAME COLUMN created_by_addr TO created_by;
    `);

    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        RENAME COLUMN last_updated_by_addr TO last_updated_by;
    `);
  }
}
