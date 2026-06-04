import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MemberNameLength1780900000000 implements MigrationInterface {
  name = 'MemberNameLength1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE character varying(30)`,
    );
  }
}
