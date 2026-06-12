// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSpaceAuditLog1781200000000 implements MigrationInterface {
  name = 'CreateSpaceAuditLog1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "space_audit_log" (
        "id" BIGINT GENERATED ALWAYS AS IDENTITY,
        -- no FK: the log must survive space deletion
        "space_id" integer NOT NULL,
        "space_uuid" uuid NOT NULL,
        "event_type" character varying(64) NOT NULL,
        "actor_user_id" integer NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_SAL_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_SAL_space_created_id" ON "space_audit_log" ("space_id", "created_at", "id")`,
    );

    await queryRunner.query(`
      CREATE FUNCTION space_audit_log_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION 'space_audit_log is append-only';
      END;
      $$ language 'plpgsql';`);
    await queryRunner.query(`
      CREATE TRIGGER space_audit_log_no_update_delete
        BEFORE UPDATE OR DELETE ON space_audit_log
        FOR EACH ROW EXECUTE PROCEDURE space_audit_log_immutable();`);
    await queryRunner.query(`
      CREATE TRIGGER space_audit_log_no_truncate
        BEFORE TRUNCATE ON space_audit_log
        FOR EACH STATEMENT EXECUTE PROCEDURE space_audit_log_immutable();`);

    await queryRunner.query(`
      CREATE FUNCTION space_audit_log_force_created_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.created_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';`);
    await queryRunner.query(`
      CREATE TRIGGER space_audit_log_force_created_at
        BEFORE INSERT ON space_audit_log
        FOR EACH ROW EXECUTE PROCEDURE space_audit_log_force_created_at();`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "space_audit_log"`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS space_audit_log_immutable`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS space_audit_log_force_created_at`,
    );
  }
}
