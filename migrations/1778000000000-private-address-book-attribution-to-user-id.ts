// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PrivateAddressBookAttributionToUserId1778000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Pre-prod: drop wallet-string actor columns; OIDC users have no wallet.
    // Identity is now derived from existing user FKs.

    await queryRunner.query(`
      ALTER TABLE user_address_book_items
        DROP COLUMN created_by;
    `);

    await queryRunner.query(`
      ALTER TABLE address_book_requests
        DROP COLUMN requested_by_wallet,
        DROP COLUMN reviewed_by;
    `);

    await queryRunner.query(`
      ALTER TABLE address_book_requests
        ADD COLUMN reviewed_by integer;
    `);

    await queryRunner.query(`
      ALTER TABLE address_book_requests
        ADD CONSTRAINT "FK_ABR_reviewed_by"
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE address_book_requests
        DROP CONSTRAINT "FK_ABR_reviewed_by";
    `);

    await queryRunner.query(`
      ALTER TABLE address_book_requests
        DROP COLUMN reviewed_by;
    `);

    await queryRunner.query(`
      ALTER TABLE address_book_requests
        ADD COLUMN requested_by_wallet varchar(42),
        ADD COLUMN reviewed_by varchar(42);
    `);

    await queryRunner.query(`
      ALTER TABLE user_address_book_items
        ADD COLUMN created_by varchar(42);
    `);
  }
}
