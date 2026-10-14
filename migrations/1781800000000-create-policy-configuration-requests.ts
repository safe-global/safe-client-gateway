// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stores the `Configuration[]` of a delayed policy configuration request, which
 * `requestConfiguration(bytes32 root)` does not publish on-chain.
 *
 * - `root` is recomputed from `configurations` by the application before a row is
 *   written, so a row always describes a configuration the Safe requested.
 * - `configurations` is capped at 64 KiB of JSON text, so one row cannot grow
 *   without bound whatever the HTTP body limit is configured to.
 * - `space_id` cascades: a Space's stored configurations go with it. No FK to
 *   users - a row outlives the user who submitted it.
 * - Rows are immutable: a different configuration hashes to a different root,
 *   hence a different row. A trigger rejects every `UPDATE`; `DELETE` stays
 *   allowed, for the Space cascade and for pruning applied or invalidated roots.
 */
export class CreatePolicyConfigurationRequests1781800000000
  implements MigrationInterface
{
  name = 'CreatePolicyConfigurationRequests1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "policy_configuration_requests" (
        "id" BIGINT GENERATED ALWAYS AS IDENTITY,
        "chain_id" character varying(78) NOT NULL,
        "safe_address" character varying(42) NOT NULL,
        "root" character varying(66) NOT NULL,
        "configurations" jsonb NOT NULL,
        "space_id" integer NOT NULL,
        -- no FK: the row must survive user deletion
        "created_by" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_PCR_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_PCR_chain_safe_root" UNIQUE ("chain_id", "safe_address", "root"),
        CONSTRAINT "FK_PCR_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE,
        -- 64 KiB of JSON text, as Postgres serializes the jsonb value
        CONSTRAINT "CHK_PCR_configurations_size" CHECK (octet_length("configurations"::text) <= 65536)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_PCR_chain_safe" ON "policy_configuration_requests" ("chain_id", "safe_address")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_PCR_space_id" ON "policy_configuration_requests" ("space_id")`,
    );

    await queryRunner.query(`
      CREATE FUNCTION policy_configuration_requests_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION 'policy_configuration_requests rows are immutable';
      END;
      $$ language 'plpgsql';`);
    await queryRunner.query(`
      CREATE TRIGGER policy_configuration_requests_no_update
        BEFORE UPDATE ON policy_configuration_requests
        FOR EACH ROW EXECUTE PROCEDURE policy_configuration_requests_immutable();`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "policy_configuration_requests"`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS policy_configuration_requests_immutable`,
    );
  }
}
