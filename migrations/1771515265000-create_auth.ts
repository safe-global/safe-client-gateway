// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuth1771515265000 implements MigrationInterface {
  name = 'CreateAuth1771515265000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "auth" ("id" SERIAL NOT NULL, "type" integer NOT NULL, "ext_user_id" character varying(255) NOT NULL, "user_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_auth_type_ext_user_id" UNIQUE ("type", "ext_user_id"), CONSTRAINT "PK_auth_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_auth_user_id" ON "auth" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" ADD CONSTRAINT "FK_auth_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_auth_updated_at BEFORE UPDATE ON auth FOR EACH ROW EXECUTE PROCEDURE update_updated_at()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_auth_updated_at ON auth`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth" DROP CONSTRAINT "FK_auth_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_auth_user_id"`);
    await queryRunner.query(`DROP TABLE "auth"`);
  }
}
