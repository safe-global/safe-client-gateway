// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `subscriptions.plan_code`, the offer a subscription was sold under.
 * Nullable: rows written before this carry none until their next sync, and
 * upstream may omit it. No index, as nothing filters on it yet.
 */
export class AddSubscriptionsPlanCode1790327834880
  implements MigrationInterface
{
  name = 'AddSubscriptionsPlanCode1790327834880';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "plan_code" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "plan_code"`,
    );
  }
}
