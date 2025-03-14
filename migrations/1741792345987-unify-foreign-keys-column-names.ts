import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyForeignKeysColumnNames1741792345987
  implements MigrationInterface
{
  name = 'UnifyForeignKeysColumnNames1741792345987';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_organizations" RENAME COLUMN "userId" TO "user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_organizations" RENAME COLUMN "organizationId" TO "organization_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_organizations" RENAME COLUMN "user_id" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_organizations" RENAME COLUMN "organization_id" TO "organizationId"`,
    );
  }
}
