import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateUserOrganizationsToMembers1742572795471
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE user_organizations RENAME TO members;
        ALTER TABLE members RENAME CONSTRAINT "PK_UO_id" TO "PK_members_id";
        ALTER TABLE members RENAME CONSTRAINT "UQ_user_organizations" TO "UQ_members_user_space";
        ALTER INDEX "idx_UO_name" RENAME TO "idx_members_name";
        ALTER INDEX "idx_UO_role_status" RENAME TO "idx_members_role_status";
        ALTER TABLE members RENAME COLUMN organization_id TO space_id;
        DROP TRIGGER update_updated_at ON members;
        CREATE TRIGGER update_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ALTER TABLE members RENAME CONSTRAINT "FK_UO_organization_id" TO "FK_members_space_id";
        ALTER TABLE members RENAME CONSTRAINT "FK_UO_user_id" TO "FK_members_user_id";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE members RENAME TO user_organizations;
        ALTER TABLE user_organizations RENAME CONSTRAINT "PK_members_id" TO "PK_UO_id";
        ALTER TABLE user_organizations RENAME CONSTRAINT "UQ_members_user_space" TO "UQ_user_organizations";
        ALTER INDEX "idx_members_name" RENAME TO "idx_UO_name";
        ALTER INDEX "idx_members_role_status" RENAME TO "idx_UO_role_status";
        ALTER TABLE user_organizations RENAME COLUMN space_id TO organization_id;
        DROP TRIGGER update_updated_at ON user_organizations;
        CREATE TRIGGER update_updated_at BEFORE UPDATE ON user_organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ALTER TABLE user_organizations RENAME CONSTRAINT "FK_members_space_id" TO "FK_UO_organization_id";
        ALTER TABLE user_organizations RENAME CONSTRAINT "FK_members_user_id" TO "FK_UO_user_id";
    `);
  }
}
