// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops `space_seat_selection`. It shipped with the entitlements model in
 * #3327 for an endpoint that is no longer planned, and nothing ever read or
 * wrote it — no repository was registered for it.
 */
export class DropSpaceSeatSelection1787234204003 implements MigrationInterface {
  name = 'DropSpaceSeatSelection1787234204003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Takes its index, trigger and both foreign keys with it.
    await queryRunner.query(`DROP TABLE "space_seat_selection"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "space_seat_selection" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "space_id" integer NOT NULL, "space_safe_id" integer NOT NULL, CONSTRAINT "UQ_SSSEL_space_safe_id" UNIQUE ("space_safe_id"), CONSTRAINT "PK_SSSEL_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_SSSEL_space_id" ON "space_seat_selection" ("space_id")`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_updated_at
        BEFORE UPDATE ON space_seat_selection
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_seat_selection" ADD CONSTRAINT "FK_SSSEL_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_seat_selection" ADD CONSTRAINT "FK_SSSEL_space_safe_id" FOREIGN KEY ("space_safe_id") REFERENCES "space_safes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
