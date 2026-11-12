// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSpaceSetups1794441600000 implements MigrationInterface {
  name = 'CreateSpaceSetups1794441600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // UQ_space_setups_space_id also indexes space_id, the only lookup column.
    await queryRunner.query(`
      CREATE TABLE "space_setups" (
        "id" SERIAL NOT NULL,
        "space_id" integer NOT NULL,
        "payment_link_id" character varying(255),
        "payload" text NOT NULL,
        "status" smallint NOT NULL,
        "applied_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_space_setups_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_space_setups_space_id" UNIQUE ("space_id"),
        CONSTRAINT "FK_space_setups_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_space_setups_status" CHECK ("status" IN (1, 2, 3))
      )
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_space_setups_updated_at
        BEFORE UPDATE ON "space_setups"
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_space_setups_updated_at ON "space_setups"`,
    );
    await queryRunner.query(`DROP TABLE "space_setups"`);
  }
}
