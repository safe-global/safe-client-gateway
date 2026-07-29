// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the feature catalog. The list and each feature's type mirror
 * `FeatureKeys`/`FEATURE_DEFINITIONS` in
 * `src/modules/entitlements/domain/entities/feature.entity.ts` (asserted by
 * an integration test); migrations stay literal SQL by convention.
 *
 * Free-tier quotas/values are initial defaults pending product sign-off;
 * changing the Free tier later is an UPDATE on these rows (it applies to
 * every free workspace instantly).
 *
 * `free_period` is the Free usage window in DAYS (metered, event-type
 * consumption only), anchored at the workspace's creation date. Stock-type
 * metered features (seats, members) have no window: usage is a live COUNT.
 */
export class SeedFeatures1781810000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "features" ("key", "type", "description", "free_enabled", "free_quota", "free_value", "free_period") VALUES
        ('security_hub',           'binary',  'Security Hub for workspace Safes',                        FALSE, NULL, NULL,   NULL),
        ('safe_seats',             'metered', 'Number of Safe Accounts in the workspace',                TRUE,  10,   NULL,   NULL),
        ('members',                'metered', 'Number of workspace members (active or invited)',         TRUE,  5,    NULL,   NULL),
        ('copilot_scans',          'binary',  'Copilot full-report scans per cycle',                     FALSE, NULL, NULL,   NULL),
        ('sponsored_transactions', 'metered', 'Gas-sponsored transactions per cycle',                    FALSE, 0,    NULL,   30),
        ('swap_fee_tier',          'value',   'Swap/earn fee tier',                                      TRUE,  NULL, 'free', NULL),
        ('shared_address_book',    'binary',  'Workspace-shared address book',                           TRUE,  NULL, NULL,   NULL),
        ('pay_from_safe',          'binary',  'Pay for the subscription from a Safe',                    FALSE, NULL, NULL,   NULL),
        ('sso',                    'binary',  'Single sign-on for workspace members',                    FALSE, NULL, NULL,   NULL);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "features" WHERE "key" IN
        ('security_hub','safe_seats','members','copilot_scans','sponsored_transactions','swap_fee_tier','shared_address_book','pay_from_safe','sso');
    `);
  }
}
