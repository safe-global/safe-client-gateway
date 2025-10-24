import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssets1761316443000 implements MigrationInterface {
  name = 'CreateAssets1761316443000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "assets" ("id" SERIAL NOT NULL, "asset_id" character varying(50) NOT NULL, "symbol" character varying(100) NOT NULL, "name" character varying(255) NOT NULL, "is_canonical" boolean NOT NULL DEFAULT true, "provider_ids" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_assets_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_asset_asset_id" UNIQUE ("asset_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_asset_asset_id" ON "assets" ("asset_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_provider_ids_gin" ON "assets" USING GIN ("provider_ids")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_provider_ids_gin"`);
    await queryRunner.query(`DROP INDEX "public"."idx_asset_asset_id"`);
    await queryRunner.query(`DROP TABLE "assets"`);
  }
}
