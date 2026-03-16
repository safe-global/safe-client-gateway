import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EncryptNameColumns1773667103000 implements MigrationInterface {
  name = 'EncryptNameColumns1773667103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ADD COLUMN "name_hash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ADD COLUMN "encryption_version" integer`,
    );

    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ADD COLUMN "name_hash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ADD COLUMN "encryption_version" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" DROP COLUMN "encryption_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" DROP COLUMN "name_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE character varying(50)`,
    );

    await queryRunner.query(
      `ALTER TABLE "members" DROP COLUMN "encryption_version"`,
    );
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "name_hash"`);
    await queryRunner.query(
      `ALTER TABLE "members" ALTER COLUMN "name" TYPE character varying(30)`,
    );
  }
}
