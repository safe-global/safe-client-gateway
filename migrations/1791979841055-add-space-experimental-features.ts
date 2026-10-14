// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

// No index: nothing filters on this column.
export class AddSpaceExperimentalFeatures1791979841055
  implements MigrationInterface
{
  name = 'AddSpaceExperimentalFeatures1791979841055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spaces" ADD "experimental_features" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spaces" DROP COLUMN "experimental_features"`,
    );
  }
}
