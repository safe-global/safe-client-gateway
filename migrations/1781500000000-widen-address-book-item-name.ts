// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenAddressBookItemName1781500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        ALTER COLUMN name TYPE varchar(50);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NOTE: narrowing back to 30 could truncate any name of 31–50 chars saved
    // while the column was varchar(50). Safe in practice (rollbacks are rare),
    // but be aware before reverting.
    await queryRunner.query(`
      ALTER TABLE space_address_book_items
        ALTER COLUMN name TYPE varchar(30);
    `);
  }
}
