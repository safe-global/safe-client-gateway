// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `sponsored_transactions` feature. Inert: the Free tier grants
 * none, and a plan only grants it once its `FEATURE_SPONSORED_TRANSACTIONS`
 * metadata ships upstream.
 */
export class SeedSponsoredTransactionsFeature1789380815792
  implements MigrationInterface
{
  name = 'SeedSponsoredTransactionsFeature1789380815792';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "features" ("key", "type", "description", "free_enabled", "free_quota", "free_value", "free_period") VALUES ('sponsored_transactions', 'metered', 'Transactions a workspace can have relayed at our expense', false, 0, NULL, 30) ON CONFLICT ("key") DO NOTHING`,
    );
  }

  // The dependents go first: both reference `features` with ON DELETE RESTRICT,
  // so undoing the seed discards the feature's purchased rows and counters.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "space_feature_usage" WHERE "feature_id" IN (SELECT "id" FROM "features" WHERE "key" = 'sponsored_transactions')`,
    );
    await queryRunner.query(
      `DELETE FROM "subscription_entitlements" WHERE "feature_id" IN (SELECT "id" FROM "features" WHERE "key" = 'sponsored_transactions')`,
    );
    await queryRunner.query(
      `DELETE FROM "features" WHERE "key" = 'sponsored_transactions'`,
    );
  }
}
