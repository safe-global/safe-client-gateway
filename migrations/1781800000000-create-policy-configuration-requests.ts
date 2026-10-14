// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stores the `Configuration[]` of a delayed policy configuration request, which
 * `requestConfiguration(bytes32 root)` does not publish on-chain.
 *
 * - `policy_configuration_requests` holds one row per request; its
 *   `Configuration[]` lives in `policy_configurations`, one row per entry, in
 *   `position` order - the order the root hashes them in.
 * - `root` is recomputed from the configurations by the application before a
 *   request is written, so a request always describes configurations the Safe
 *   requested.
 * - A configuration's `data` is capped at 64 KiB of bytes (0x-prefixed hex, so
 *   at most 2 + 131072 characters), whatever the HTTP body limit is set to.
 * - `space_id` cascades: a Space's stored requests go with it, and a request's
 *   configurations go with the request. No FK to users - a request outlives the
 *   user who submitted it.
 * - Rows are immutable: a different configuration hashes to a different root,
 *   hence a different request. A trigger rejects every `UPDATE` on both tables;
 *   `DELETE` stays allowed, for the cascades and for pruning applied or
 *   invalidated roots.
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
        "space_id" integer NOT NULL,
        -- no FK: the row must survive user deletion
        "created_by" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_PCR_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_PCR_chain_safe_root" UNIQUE ("chain_id", "safe_address", "root"),
        CONSTRAINT "FK_PCR_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_PCR_chain_safe" ON "policy_configuration_requests" ("chain_id", "safe_address")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_PCR_space_id" ON "policy_configuration_requests" ("space_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "policy_configurations" (
        "id" BIGINT GENERATED ALWAYS AS IDENTITY,
        "request_id" bigint NOT NULL,
        -- index of the entry in the Configuration[] the root hashes
        "position" integer NOT NULL,
        "target" character varying(42) NOT NULL,
        "selector" character varying(10) NOT NULL,
        "operation" smallint NOT NULL,
        "policy" character varying(42) NOT NULL,
        "data" text NOT NULL,
        CONSTRAINT "PK_PC_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_PC_request_position" UNIQUE ("request_id", "position"),
        CONSTRAINT "FK_PC_request_id" FOREIGN KEY ("request_id") REFERENCES "policy_configuration_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_PC_position" CHECK ("position" >= 0),
        CONSTRAINT "CHK_PC_operation" CHECK ("operation" IN (0, 1)),
        -- 64 KiB of bytes, as 0x-prefixed hex
        CONSTRAINT "CHK_PC_data_size" CHECK (octet_length("data") <= 131074)
      )
    `);
    // FK_PC_request_id is served by the UQ_PC_request_position index, whose
    // leading column is request_id.

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
    await queryRunner.query(`
      CREATE TRIGGER policy_configurations_no_update
        BEFORE UPDATE ON policy_configurations
        FOR EACH ROW EXECUTE PROCEDURE policy_configuration_requests_immutable();`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "policy_configurations"`);
    await queryRunner.query(`DROP TABLE "policy_configuration_requests"`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS policy_configuration_requests_immutable`,
    );
  }
}
