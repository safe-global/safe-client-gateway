// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropSpaceExperimentalFeatures1795443131760
  implements MigrationInterface
{
  name = 'DropSpaceExperimentalFeatures1795443131760';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spaces" DROP COLUMN "experimental_features"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spaces" ADD "experimental_features" jsonb NOT NULL DEFAULT '[]'`,
    );
  }
}
