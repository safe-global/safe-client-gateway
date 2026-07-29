// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Entitlements layer: materialized subscription state and feature gating.
 *
 * - `features`: catalog of gateable features (seeded by the follow-up
 *   migration). The Free package is defined here per feature (`free_*`).
 * - `subscriptions`: one row per upstream (billing-service/Stripe)
 *   subscription; at most one non-terminal ("active slot") row per space,
 *   enforced by a partial unique index. Terminal rows are kept as history —
 *   grandfathering depends on "never had ANY subscription row".
 * - `subscription_entitlements`: the purchased feature package of a
 *   subscription (replaced wholesale on webhook materialization).
 * - `space_feature_usage`: counters ONLY for event-type consumption
 *   (e.g. gas-sponsored transactions). Keyed by period start so quota resets
 *   are implicit.
 * - `space_seat_selection`: a workspace admin's explicit choice of which
 *   Safes keep the covered seats when over-seat (rows exist only once
 *   edited; default coverage is computed oldest-first at read time).
 */
export class CreateEntitlements1781800000000 implements MigrationInterface {
  name = 'CreateEntitlements1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "features" (
        "id" integer GENERATED ALWAYS AS IDENTITY,
        "key" character varying(64) NOT NULL,
        "type" character varying(16) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "free_enabled" boolean NOT NULL DEFAULT FALSE,
        "free_quota" integer,
        "free_value" character varying(255),
        "free_period" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_features_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_features_key" UNIQUE ("key"),
        CONSTRAINT "CHK_features_type" CHECK ("type" IN ('binary','metered','value'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" integer GENERATED ALWAYS AS IDENTITY,
        "space_id" integer NOT NULL,
        "upstream_subscription_id" character varying(255) NOT NULL,
        "status" character varying(32) NOT NULL,
        "plan_id" character varying(255) NOT NULL,
        "plan_name" character varying(255),
        "current_period_start" TIMESTAMP WITH TIME ZONE,
        "current_period_end" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subscriptions_upstream_id" UNIQUE ("upstream_subscription_id"),
        CONSTRAINT "FK_subscriptions_space_id" FOREIGN KEY ("space_id")
          REFERENCES "spaces"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_subscriptions_status" CHECK ("status" IN
          ('active','canceled','incomplete','incomplete_expired','past_due','paused','trialing','unpaid'))
      )
    `);
    // At most one subscription may hold a space's "active slot"; terminal
    // rows (canceled, incomplete*) remain as history.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_subscriptions_active_space"
        ON "subscriptions" ("space_id")
        WHERE "status" IN ('active','trialing','past_due','paused','unpaid')
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_space_id" ON "subscriptions" ("space_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "subscription_entitlements" (
        "id" integer GENERATED ALWAYS AS IDENTITY,
        "subscription_id" integer NOT NULL,
        "feature_id" integer NOT NULL,
        "enabled" boolean NOT NULL,
        "quota" integer,
        "value" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_SE_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_SE_subscription_feature" UNIQUE ("subscription_id", "feature_id"),
        CONSTRAINT "FK_SE_subscription_id" FOREIGN KEY ("subscription_id")
          REFERENCES "subscriptions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_SE_feature_id" FOREIGN KEY ("feature_id")
          REFERENCES "features"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "space_feature_usage" (
        "id" integer GENERATED ALWAYS AS IDENTITY,
        "space_id" integer NOT NULL,
        "feature_id" integer NOT NULL,
        "period_start" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_SFU_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_SFU_space_feature_period" UNIQUE ("space_id", "feature_id", "period_start"),
        CONSTRAINT "FK_SFU_space_id" FOREIGN KEY ("space_id")
          REFERENCES "spaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_SFU_feature_id" FOREIGN KEY ("feature_id")
          REFERENCES "features"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "space_seat_selection" (
        "id" integer GENERATED ALWAYS AS IDENTITY,
        "space_id" integer NOT NULL,
        "space_safe_id" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_SSSEL_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_SSSEL_space_safe_id" UNIQUE ("space_safe_id"),
        CONSTRAINT "FK_SSSEL_space_id" FOREIGN KEY ("space_id")
          REFERENCES "spaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_SSSEL_space_safe_id" FOREIGN KEY ("space_safe_id")
          REFERENCES "space_safes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_SSSEL_space_id" ON "space_seat_selection" ("space_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "space_seat_selection"`);
    await queryRunner.query(`DROP TABLE "space_feature_usage"`);
    await queryRunner.query(`DROP TABLE "subscription_entitlements"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TABLE "features"`);
  }
}
