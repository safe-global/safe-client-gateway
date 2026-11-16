// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `safenet_checks` feature. The Free tier grants none; a plan grants
 * it through its `FEATURE_SAFENET_CHECKS` metadata.
 */
export class SeedSafenetChecksFeature1792165001499
  implements MigrationInterface
{
  name = 'SeedSafenetChecksFeature1792165001499';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "features" ("key", "type", "description", "free_enabled", "free_quota", "free_value", "free_period") VALUES ('safenet_checks', 'binary', 'Safenet checks of Safe transactions, paid by Safe Labs, on a Space', false, NULL, NULL, NULL) ON CONFLICT ("key") DO NOTHING`,
    );
  }

  // The dependents go first: both reference `features` with ON DELETE RESTRICT,
  // so undoing the seed discards the feature's purchased rows and counters.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "space_feature_usage" WHERE "feature_id" IN (SELECT "id" FROM "features" WHERE "key" = 'safenet_checks')`,
    );
    await queryRunner.query(
      `DELETE FROM "subscription_entitlements" WHERE "feature_id" IN (SELECT "id" FROM "features" WHERE "key" = 'safenet_checks')`,
    );
    await queryRunner.query(
      `DELETE FROM "features" WHERE "key" = 'safenet_checks'`,
    );
  }
}
