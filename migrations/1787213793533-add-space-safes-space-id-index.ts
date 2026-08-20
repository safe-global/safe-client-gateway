// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `space_safes.space_id` is a foreign key with no index of its own: the three
 * existing indexes all lead with `chain_id` and leave `space_id` third, so a
 * lookup keyed on the workspace alone cannot use any of them. The entitlements
 * endpoint counts a workspace's Safes on every request, which made that count
 * a sequential scan over every workspace's rows.
 */
export class AddSpaceSafesSpaceIdIndex1787213793533
  implements MigrationInterface
{
  name = 'AddSpaceSafesSpaceIdIndex1787213793533';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_SS_space_id" ON "space_safes" ("space_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_SS_space_id"`);
  }
}
