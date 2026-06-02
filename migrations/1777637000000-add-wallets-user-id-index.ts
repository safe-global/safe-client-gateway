// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletsUserIdIndex1777637000000 implements MigrationInterface {
  name = 'AddWalletsUserIdIndex1777637000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_wallets_user_id" ON "wallets" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_wallets_user_id"`);
  }
}
