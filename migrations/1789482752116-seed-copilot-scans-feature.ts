// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `copilot_scans` feature.
 */
export class SeedCopilotScansFeature1789482752116
  implements MigrationInterface
{
  name = 'SeedCopilotScansFeature1789482752116';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "features" ("key", "type", "description", "free_enabled", "free_quota", "free_value", "free_period") VALUES ('copilot_scans', 'binary', 'Copilot recipient and counterparty analysis on a Space', false, NULL, NULL, NULL) ON CONFLICT ("key") DO NOTHING`,
    );
  }

  // The dependents go first: both reference `features` with ON DELETE RESTRICT,
  // so undoing the seed discards the feature's purchased rows and counters.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "space_feature_usage" WHERE "feature_id" IN (SELECT "id" FROM "features" WHERE "key" = 'copilot_scans')`,
    );
    await queryRunner.query(
      `DELETE FROM "subscription_entitlements" WHERE "feature_id" IN (SELECT "id" FROM "features" WHERE "key" = 'copilot_scans')`,
    );
    await queryRunner.query(
      `DELETE FROM "features" WHERE "key" = 'copilot_scans'`,
    );
  }
}
