import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserOrganizationsInvitedByField1740053306706
  implements MigrationInterface
{
  name = 'AddUserOrganizationsInvitedByField1740053306706';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_organizations" ADD COLUMN "invited_by" character varying(42) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_organizations" DROP COLUMN "invited_by"`,
    );
  }
}
