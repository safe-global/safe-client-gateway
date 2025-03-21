import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateOrganizationsToSpaces1742571887114
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE organizations RENAME TO spaces;
        ALTER TABLE spaces RENAME CONSTRAINT "PK_org_id" TO "PK_spaces_id";
        ALTER INDEX idx_org_status RENAME TO idx_spaces_status;
        DROP TRIGGER update_organizations_updated_at ON spaces;
        CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE spaces RENAME TO organizations;
        ALTER TABLE organizations RENAME CONSTRAINT "PK_spaces_id" TO "PK_org_id";
        ALTER INDEX idx_spaces_status RENAME TO idx_org_status;
        DROP TRIGGER update_spaces_updated_at ON organizations;
        CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
  }
}
