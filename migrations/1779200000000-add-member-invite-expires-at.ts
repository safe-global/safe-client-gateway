// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMemberInviteExpiresAt1779200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE members
        ADD COLUMN invite_expires_at timestamp with time zone;
    `);

    // Existing outstanding invites get a fresh 7-day TTL from migration time.
    await queryRunner.query(`
      UPDATE members
        SET invite_expires_at = NOW() + interval '7 days'
        WHERE status = 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE members
        DROP COLUMN invite_expires_at;
    `);
  }
}
