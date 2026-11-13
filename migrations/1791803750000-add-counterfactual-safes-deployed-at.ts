// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `counterfactual_safes.deployed_at`. A deployed Safe keeps its row as a
 * record; every read filters on `deployed_at IS NULL`.
 */
export class AddCounterfactualSafesDeployedAt1791803750000
  implements MigrationInterface
{
  name = 'AddCounterfactualSafesDeployedAt1791803750000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "counterfactual_safes" ADD "deployed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX IDX_CFS_deployed_at ON counterfactual_safes(deployed_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IDX_CFS_deployed_at`);
    await queryRunner.query(
      `ALTER TABLE "counterfactual_safes" DROP COLUMN "deployed_at"`,
    );
  }
}
