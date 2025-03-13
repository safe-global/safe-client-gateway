import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationsSafeUniqueIndex1741709533269
  implements MigrationInterface
{
  name = 'AddOrganizationsSafeUniqueIndex1741709533269';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM organization_safes WHERE id NOT IN (SELECT MIN(id) FROM organization_safes GROUP BY chain_id, address);`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX UQ_OS_chainId_address ON organization_safes (chain_id, address);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX UQ_OS_chainId_address;`);
  }
}
