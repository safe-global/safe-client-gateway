import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterOrganizationsSafeUniqueIndex1742295485154
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX UQ_OS_chainId_address; CREATE UNIQUE INDEX UQ_OS_chainId_address_organization ON organization_safes (chain_id, address, organization_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX UQ_OS_chainId_address_organization; CREATE UNIQUE INDEX UQ_OS_chainId_address ON organization_safes (chain_id, address);`,
    );
  }
}
