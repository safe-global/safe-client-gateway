import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddressBookItemLength1755621780124 implements MigrationInterface {
  name = 'AddressBookItemLength1755621780124';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "space_address_book_items" ALTER COLUMN "name" TYPE character varying(30)`,
    );
  }
}
