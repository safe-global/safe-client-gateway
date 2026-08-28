// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stores the `Configuration[]` of a delayed policy configuration request, which
 * `requestConfiguration(bytes32 root)` does not publish on-chain.
 *
 * - `root` is recomputed from `configurations` by the application before a row is
 *   written, so a row always describes a configuration the Safe requested.
 * - No FK to spaces or users: deleting either must not destroy the ability to
 *   apply or explain a Safe's requested change.
 * - Rows are immutable in the application layer (a different configuration
 *   hashes to a different root, hence a different row). Not enforced by a
 *   trigger: unlike `space_audit_log` this table is prunable, and rewriting a row
 *   cannot forge state - `root` verification does that.
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
        -- no FK: the row must survive space deletion
        "space_id" integer NOT NULL,
        -- no FK: the row must survive user deletion
        "created_by" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_PCR_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_PCR_chain_safe_root" UNIQUE ("chain_id", "safe_address", "root")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_PCR_chain_safe" ON "policy_configuration_requests" ("chain_id", "safe_address")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_PCR_chain_safe"`);
    await queryRunner.query(`DROP TABLE "policy_configuration_requests"`);
  }
}
