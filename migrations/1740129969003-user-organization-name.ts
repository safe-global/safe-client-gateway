import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserOrganizationName1740129969003 implements MigrationInterface {
  name = 'UserOrganizationName1740129969003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE user_organizations
        SET name = 'OrganizationUser_' || "user_organizations"."userId"
        WHERE name IS NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_organizations" ALTER COLUMN "name" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_organizations" ALTER COLUMN "name" DROP NOT NULL`,
    );
  }
}
