// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `safe_seats` feature.
 */
export class SeedFeatures1787148838500 implements MigrationInterface {
  name = 'SeedFeatures1787148838500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "features" ("key", "type", "description", "free_enabled", "free_quota", "free_value", "free_period") VALUES ('safe_seats', 'metered', 'Safes a workspace can hold', false, 0, NULL, NULL) ON CONFLICT ("key") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "features" WHERE "key" = 'safe_seats'`,
    );
  }
}
