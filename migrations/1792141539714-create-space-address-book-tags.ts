// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSpaceAddressBookTags1792141539714
  implements MigrationInterface
{
  name = 'CreateSpaceAddressBookTags1792141539714';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "space_address_book_tags" (
        "id" SERIAL NOT NULL,
        "space_id" integer NOT NULL,
        "name" text NOT NULL,
        "name_index" text NOT NULL,
        "color" character varying(16) NOT NULL,
        "created_by" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_SABT_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_SABT_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_SABT_space_id_name_index" UNIQUE ("space_id", "name_index"),
        CONSTRAINT "UQ_SABT_space_id_color" UNIQUE ("space_id", "color"),
        CONSTRAINT "CHK_SABT_color" CHECK ("color" IN ('slate', 'clay', 'rose', 'lilac', 'iris', 'cobalt', 'sky', 'lagoon'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_SABT_space_id" ON "space_address_book_tags" ("space_id")`,
    );
    await queryRunner.query(`
      CREATE TRIGGER update_space_address_book_tags_updated_at
        BEFORE UPDATE ON "space_address_book_tags"
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at()
    `);

    await queryRunner.query(`
      CREATE TABLE "space_address_book_item_tags" (
        "id" SERIAL NOT NULL,
        "item_id" integer NOT NULL,
        "tag_id" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_SABIT_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_SABIT_item_id_tag_id" UNIQUE ("item_id", "tag_id"),
        CONSTRAINT "FK_SABIT_item_id" FOREIGN KEY ("item_id") REFERENCES "space_address_book_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_SABIT_tag_id" FOREIGN KEY ("tag_id") REFERENCES "space_address_book_tags"("id") ON DELETE CASCADE
      )
    `);
    // item_id is covered by UQ_SABIT_item_id_tag_id (leading column).
    await queryRunner.query(
      `CREATE INDEX "IDX_SABIT_tag_id" ON "space_address_book_item_tags" ("tag_id")`,
    );
    await queryRunner.query(`
      CREATE TRIGGER update_space_address_book_item_tags_updated_at
        BEFORE UPDATE ON "space_address_book_item_tags"
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_space_address_book_item_tags_updated_at ON "space_address_book_item_tags"`,
    );
    await queryRunner.query(`DROP TABLE "space_address_book_item_tags"`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_space_address_book_tags_updated_at ON "space_address_book_tags"`,
    );
    await queryRunner.query(`DROP TABLE "space_address_book_tags"`);
  }
}
