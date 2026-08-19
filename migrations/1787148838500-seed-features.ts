// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the only feature the product has signed off, `safe_seats`. Its
 * `free_*` columns grant nothing: there is no free plan, so a workspace
 * without an active subscription holds no seats and has no window to reset.
 *
 * Kept in step with `FEATURE_KEYS`, which publishes the catalog keys as an
 * OpenAPI enum.
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
