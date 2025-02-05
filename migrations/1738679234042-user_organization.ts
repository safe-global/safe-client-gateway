import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserOrganization1738679234042 implements MigrationInterface {
  name = 'UserOrganization1738679234042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_organizations" ("id" SERIAL NOT NULL, "name" character varying(255), "role" integer NOT NULL, "status" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" integer NOT NULL, "organizationId" integer NOT NULL, CONSTRAINT "UQ_user_organizations" UNIQUE ("userId", "organizationId"), CONSTRAINT "PK_UO_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_UO_role_status" ON "user_organizations" ("role", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_UO_name" ON "user_organizations" ("name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_organizations" ADD CONSTRAINT "FK_UO_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_organizations" ADD CONSTRAINT "FK_UO_organization_id" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`
        CREATE TRIGGER update_updated_at
            BEFORE UPDATE
            ON
                user_organizations
            FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_updated_at ON user_organizations;`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_organizations" DROP CONSTRAINT "FK_UO_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_organizations" DROP CONSTRAINT "FK_UO_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_UO_name"`);
    await queryRunner.query(`DROP INDEX "public"."idx_UO_role_status"`);
    await queryRunner.query(`DROP TABLE "user_organizations"`);
  }
}
