// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1781700000000 implements MigrationInterface {
  name = 'CreateSubscriptions1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "subscriptions" (
        "id" character varying(255) NOT NULL,
        "space_id" integer NOT NULL,
        "upstream_customer_id" character varying(255) NOT NULL,
        "status" character varying(16) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "last_event_id" character varying(255) NOT NULL,
        "last_event_occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_SUB_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_SUB_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_SUB_space_id" ON "subscriptions" ("space_id")`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_updated_at
        BEFORE UPDATE ON subscriptions
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions" CASCADE`);
  }
}
