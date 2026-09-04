// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Storage for the cloud cosigner service: one policy row per enrolled Safe
 * and one review row per proposed transaction the cosigner looked at. The
 * review row doubles as the idempotency lock for duplicate proposal events,
 * hence the unique (chain_id, safe_tx_hash) constraint.
 */
export class CreateCloudCosigner1788000000000 implements MigrationInterface {
  name = 'CreateCloudCosigner1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cloud_cosigner_policies" ("id" SERIAL NOT NULL, "chain_id" character varying(78) NOT NULL, "safe_address" character varying(42) NOT NULL, "value_threshold_usd" bigint NOT NULL, "review_unknown_contracts" boolean NOT NULL, "instructions" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_CCP_chain_id_safe_address" UNIQUE ("chain_id", "safe_address"), CONSTRAINT "PK_CCP_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_updated_at
        BEFORE UPDATE ON cloud_cosigner_policies
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );
    await queryRunner.query(
      `CREATE TABLE "cloud_cosigner_reviews" ("id" SERIAL NOT NULL, "chain_id" character varying(78) NOT NULL, "safe_address" character varying(42) NOT NULL, "safe_tx_hash" character varying(66) NOT NULL, "status" character varying(16) NOT NULL, "mode" character varying(8), "triggered_rules" jsonb NOT NULL DEFAULT '[]', "summary" text, "risk_flags" jsonb NOT NULL DEFAULT '[]', "model" character varying(64), "signature" character varying(132), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_CCR_chain_id_safe_tx_hash" UNIQUE ("chain_id", "safe_tx_hash"), CONSTRAINT "CHK_CCR_status" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','SKIPPED','FAILED')), CONSTRAINT "CHK_CCR_mode" CHECK ("mode" IS NULL OR "mode" IN ('RULES','LLM')), CONSTRAINT "PK_CCR_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CCR_chain_id_safe_address" ON "cloud_cosigner_reviews" ("chain_id", "safe_address")`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_updated_at
        BEFORE UPDATE ON cloud_cosigner_reviews
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cloud_cosigner_reviews"`);
    await queryRunner.query(`DROP TABLE "cloud_cosigner_policies"`);
  }
}
