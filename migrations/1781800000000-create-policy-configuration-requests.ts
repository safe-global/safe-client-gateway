// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stores the `Configuration[]` behind a policy configuration root.
 *
 * - One row per Space, Safe and root. `configurations` is the array in the
 *   order the root hashes it.
 * - `safe_address` is KMS ciphertext and `safe_address_index` its blind index
 *   when encryption is enabled; otherwise the plaintext address and NULL.
 *   Uniqueness is split by mode, as in `space_safes`.
 * - `space_id` cascades. No FK to users - a request outlives the user who
 *   submitted it.
 * - Rows are immutable: a trigger rejects every `UPDATE`.
 */
export class CreatePolicyConfigurationRequests1781800000000
  implements MigrationInterface
{
  name = 'CreatePolicyConfigurationRequests1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "policy_configuration_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "space_id" integer NOT NULL,
        "chain_id" character varying(78) NOT NULL,
        "safe_address" text NOT NULL,
        "safe_address_index" text,
        "root" character varying(66) NOT NULL,
        "configurations" jsonb NOT NULL,
        -- no FK: the row must survive user deletion
        "created_by" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_PCR_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_PCR_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_PCR_space_chain_safe_root_plain" ON "policy_configuration_requests" ("space_id", "chain_id", "safe_address", "root") WHERE "safe_address_index" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_PCR_space_chain_safeIndex_root" ON "policy_configuration_requests" ("space_id", "chain_id", "safe_address_index", "root") WHERE "safe_address_index" IS NOT NULL`,
    );
    // The partial unique indexes cannot serve the space_id cascade.
    await queryRunner.query(
      `CREATE INDEX "IDX_PCR_space_id" ON "policy_configuration_requests" ("space_id")`,
    );

    await queryRunner.query(`
      CREATE FUNCTION policy_configuration_requests_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME;
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
