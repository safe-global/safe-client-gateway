// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Entitlements layer: materialized subscription state and feature gating
 * (features catalog, subscriptions, subscription_entitlements,
 * space_feature_usage, space_seat_selection).
 *
 * Generated with `yarn migration:generate create-entitlements` from the
 * `*.entity.db.ts` entities (README convention), then pruned: the generator
 * also emitted normalization churn for pre-existing tables (constraint/index
 * renames unrelated to this feature), which was dropped.
 */
export class CreateEntitlements1785406836453 implements MigrationInterface {
  name = 'CreateEntitlements1785406836453';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "features" ("id" SERIAL NOT NULL, "key" character varying(64) NOT NULL, "type" character varying(16) NOT NULL, "description" text NOT NULL DEFAULT '', "free_enabled" boolean NOT NULL DEFAULT false, "free_quota" integer, "free_value" character varying(255), "free_period" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_features_key" UNIQUE ("key"), CONSTRAINT "CHK_features_type" CHECK ("type" IN ('binary','metered','value')), CONSTRAINT "PK_features_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "space_feature_usage" ("id" SERIAL NOT NULL, "period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "used" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "space_id" integer NOT NULL, "feature_id" integer NOT NULL, CONSTRAINT "UQ_SFU_space_feature_period" UNIQUE ("space_id", "feature_id", "period_start"), CONSTRAINT "PK_SFU_id" PRIMARY KEY ("id"))`,
    );
    // `feature_id` is a FK, and only the trailing column of the composite
    // UNIQUE above — Postgres's auto-index on that constraint can't serve a
    // lookup keyed on `feature_id` alone, e.g. the `ON DELETE RESTRICT` check.
    await queryRunner.query(
      `CREATE INDEX "IDX_SFU_feature_id" ON "space_feature_usage" ("feature_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "space_seat_selection" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "space_id" integer NOT NULL, "space_safe_id" integer NOT NULL, CONSTRAINT "UQ_SSSEL_space_safe_id" UNIQUE ("space_safe_id"), CONSTRAINT "PK_SSSEL_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_SSSEL_space_id" ON "space_seat_selection"  ("space_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_entitlements" ("id" SERIAL NOT NULL, "enabled" boolean NOT NULL, "quota" integer, "value" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "subscription_id" integer NOT NULL, "feature_id" integer NOT NULL, CONSTRAINT "UQ_SE_subscription_feature" UNIQUE ("subscription_id", "feature_id"), CONSTRAINT "PK_SE_id" PRIMARY KEY ("id"))`,
    );
    // Same reasoning as IDX_SFU_feature_id above: feature_id trails the
    // composite UNIQUE here too.
    await queryRunner.query(
      `CREATE INDEX "IDX_SE_feature_id" ON "subscription_entitlements" ("feature_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" SERIAL NOT NULL, "upstream_subscription_id" character varying(255) NOT NULL, "status" character varying(32) NOT NULL, "plan_id" character varying(255) NOT NULL, "plan_name" character varying(255), "current_period_start" TIMESTAMP WITH TIME ZONE, "current_period_end" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "space_id" integer NOT NULL, CONSTRAINT "UQ_subscriptions_upstream_id" UNIQUE ("upstream_subscription_id"), CONSTRAINT "CHK_subscriptions_status" CHECK ("status" IN ('active','canceled','incomplete','incomplete_expired','past_due','paused','trialing','unpaid')), CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_subscriptions_active_space" ON "subscriptions"  ("space_id") WHERE status IN ('active','trialing','past_due','paused','unpaid')`,
    );
    // The unique index above is partial (active-ish statuses only), so it
    // can't serve a lookup covering terminal-status rows or the FK's
    // `ON DELETE CASCADE` check from `spaces` — same reasoning as
    // IDX_SFU_feature_id/IDX_SE_feature_id above.
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_space_id" ON "subscriptions" ("space_id")`,
    );
    // `updated_at` is maintained by the shared trigger every other table uses
    // (see 1727701600427-update_timestamp_trigger); the entity columns are
    // declared `update: false`, so nothing writes them from the application.
    for (const table of [
      'features',
      'space_feature_usage',
      'space_seat_selection',
      'subscription_entitlements',
      'subscriptions',
    ]) {
      await queryRunner.query(
        `CREATE TRIGGER update_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "space_feature_usage" ADD CONSTRAINT "FK_SFU_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_feature_usage" ADD CONSTRAINT "FK_SFU_feature_id" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_seat_selection" ADD CONSTRAINT "FK_SSSEL_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_seat_selection" ADD CONSTRAINT "FK_SSSEL_space_safe_id" FOREIGN KEY ("space_safe_id") REFERENCES "space_safes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "FK_SE_subscription_id" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "FK_SE_feature_id" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_space_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_entitlements" DROP CONSTRAINT "FK_SE_feature_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_entitlements" DROP CONSTRAINT "FK_SE_subscription_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_seat_selection" DROP CONSTRAINT "FK_SSSEL_space_safe_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_seat_selection" DROP CONSTRAINT "FK_SSSEL_space_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_feature_usage" DROP CONSTRAINT "FK_SFU_feature_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_feature_usage" DROP CONSTRAINT "FK_SFU_space_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_subscriptions_space_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_subscriptions_active_space"`,
    );
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_SE_feature_id"`);
    await queryRunner.query(`DROP TABLE "subscription_entitlements"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_SSSEL_space_id"`);
    await queryRunner.query(`DROP TABLE "space_seat_selection"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_SFU_feature_id"`);
    await queryRunner.query(`DROP TABLE "space_feature_usage"`);
    await queryRunner.query(`DROP TABLE "features"`);
  }
}
