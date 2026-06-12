// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddressBookRequestsPendingUnique1781300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Pre-prod: only PENDING requests block duplicates so that a rejected
    // address can be requested again.
    await queryRunner.query(`
      ALTER TABLE address_book_requests
        DROP CONSTRAINT UQ_ABR_space_requester_address;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX UQ_ABR_space_requester_address_pending
        ON address_book_requests (space_id, requested_by, address)
        WHERE status = 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX UQ_ABR_space_requester_address_pending;
    `);

    await queryRunner.query(`
      ALTER TABLE address_book_requests
        ADD CONSTRAINT UQ_ABR_space_requester_address
        UNIQUE (space_id, requested_by, address);
    `);
  }
}
