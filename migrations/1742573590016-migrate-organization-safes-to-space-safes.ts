import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateOrganizationSafesToSpaceSafes1742573590016
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE organization_safes RENAME TO space_safes;
        ALTER TABLE space_safes RENAME CONSTRAINT "PK_OS_id" TO "PK_SS_id";
        ALTER INDEX UQ_OS_chainid_address_organization RENAME TO UQ_SS_chainId_address_space;
        ALTER TABLE space_safes RENAME COLUMN organization_id TO space_id;
        ALTER TABLE space_safes RENAME CONSTRAINT "FK_OS_organization_id" TO "FK_SS_space_id";
        DROP TRIGGER update_updated_at ON space_safes;
        CREATE TRIGGER update_updated_at BEFORE UPDATE ON space_safes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE space_safes RENAME TO organization_safes;
        ALTER TABLE organization_safes RENAME CONSTRAINT "PK_SS_id" TO "PK_OS_id";
        ALTER INDEX UQ_SS_chainId_address_space RENAME TO UQ_OS_chainid_address_organization;
        ALTER TABLE organization_safes RENAME COLUMN space_id TO organization_id;
        ALTER TABLE organization_safes RENAME CONSTRAINT "FK_SS_space_id" TO "FK_OS_organization_id";
        DROP TRIGGER update_updated_at ON organization_safes;
        CREATE TRIGGER update_updated_at BEFORE UPDATE ON organization_safes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
  }
}
