import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationSafe1739533422234 implements MigrationInterface {
  name = 'OrganizationSafe1739533422234';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "organization_safes" ("id" SERIAL NOT NULL, "chain_id" character varying(78) NOT NULL, "address" character varying(42) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_id" integer NOT NULL, CONSTRAINT "PK_OS_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_safes" ADD CONSTRAINT "FK_OS_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`
        CREATE TRIGGER update_updated_at
            BEFORE UPDATE
            ON
                organization_safes
            FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_safes" DROP CONSTRAINT "FK_OS_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "organization_safes"`);
  }
}
