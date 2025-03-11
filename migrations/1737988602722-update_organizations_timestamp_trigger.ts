import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrganizationsTimestampTrigger1737988602722
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
                    CREATE TRIGGER update_organizations_updated_at
                        BEFORE UPDATE
                        ON
                            organizations
                        FOR EACH ROW
                    EXECUTE PROCEDURE update_updated_at();
            `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;`,
    );
  }
}
