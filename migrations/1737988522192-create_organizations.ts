import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizations1737988522192 implements MigrationInterface {
  name = 'CreateOrganizations1737988522192';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "status" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_org_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_org_status" ON "organizations" ("status") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_org_status"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
