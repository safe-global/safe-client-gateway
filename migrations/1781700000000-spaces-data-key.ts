// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the per-space data key column. The KMS-wrapped data key
 * (`kdk:v1:<base64>`) stored here encrypts a space's fields and those of its
 * members, address book, and audit log. Nullable: populated lazily on first
 * encrypted write (or by the backfill).
 */
export class SpacesDataKey1781700000000 implements MigrationInterface {
  name = 'SpacesDataKey1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spaces" ADD COLUMN "encrypted_data_key" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spaces" DROP COLUMN "encrypted_data_key"`,
    );
  }
}
