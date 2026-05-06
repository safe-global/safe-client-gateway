// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMemberInviteExpiresAt1777000000000
  implements MigrationInterface
{
  name = 'AddMemberInviteExpiresAt1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" ADD COLUMN "invite_expires_at" timestamp with time zone`,
    );
    await queryRunner.query(
      // MemberStatus enum values at migration time: 0 = INVITED, 2 = DECLINED.
      `UPDATE "members" SET "invite_expires_at" = "created_at" + interval '7 days' WHERE "status" IN (0, 2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" DROP COLUMN "invite_expires_at"`,
    );
  }
}
