// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateMembersInvitedBy1777274846000 implements MigrationInterface {
  name = 'MigrateMembersInvitedBy1777274846000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new nullable integer column
    await queryRunner.query(
      `ALTER TABLE "members" ADD COLUMN "invited_by_user_id" INTEGER NULL`,
    );

    // 2. Pre-flight: verify all non-NULL addresses resolve to a wallet
    await queryRunner.query(`
      DO $$
      DECLARE unresolvable INTEGER;
      BEGIN
        SELECT count(*) INTO unresolvable
        FROM "members"
        WHERE "invited_by" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "wallets"
            WHERE "wallets"."address" = "members"."invited_by"
          );
        IF unresolvable > 0 THEN
          RAISE EXCEPTION '% members have unresolvable invited_by addresses',
            unresolvable;
        END IF;
      END $$;
    `);

    // 3. Backfill non-NULL rows via wallets table
    await queryRunner.query(`
      UPDATE "members" m
      SET "invited_by_user_id" = (
        SELECT w."user_id" FROM "wallets" w
        WHERE w."address" = m."invited_by"
      )
      WHERE m."invited_by" IS NOT NULL
    `);

    // 4. Drop old varchar column
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "invited_by"`);

    // 5. Rename new column
    await queryRunner.query(
      `ALTER TABLE "members" RENAME COLUMN "invited_by_user_id" TO "invited_by"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: This reversal is lossy for users with multiple wallets.
    // LIMIT 1 picks an arbitrary wallet address, which may differ from
    // the original. Acceptable for emergency rollbacks only.

    // 1. Add old varchar column back
    await queryRunner.query(
      `ALTER TABLE "members" ADD COLUMN "invited_by_address" character varying(42) NULL`,
    );

    // 2. Backfill from wallets (reverse: user_id → address)
    await queryRunner.query(`
      UPDATE "members" m
      SET "invited_by_address" = (
        SELECT w."address" FROM "wallets" w
        WHERE w."user_id" = m."invited_by"
        LIMIT 1
      )
      WHERE m."invited_by" IS NOT NULL
    `);

    // 3. Drop integer column
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "invited_by"`);

    // 4. Rename varchar column back
    await queryRunner.query(
      `ALTER TABLE "members" RENAME COLUMN "invited_by_address" TO "invited_by"`,
    );
  }
}
