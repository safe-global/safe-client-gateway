// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserAddressBookItems1781400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Pre-prod: private (per-user) space contacts were replaced by the
    // client-side address book before release; staging data is abandoned.
    await queryRunner.query(
      `DROP TABLE IF EXISTS user_address_book_items CASCADE;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE user_address_book_items (
        id SERIAL NOT NULL,
        space_id INTEGER NOT NULL,
        creator_id INTEGER NOT NULL,
        address VARCHAR(42) NOT NULL,
        name VARCHAR(50) NOT NULL,
        chain_ids VARCHAR(32) ARRAY DEFAULT '{}' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT PK_UABI_id PRIMARY KEY (id),
        CONSTRAINT UQ_UABI_space_creator_address UNIQUE (space_id, creator_id, address),
        CONSTRAINT FK_UABI_space_id FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
        CONSTRAINT FK_UABI_creator_id FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IDX_UABI_space_creator ON user_address_book_items(space_id, creator_id);`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_user_address_book_items_updated_at
        BEFORE UPDATE ON user_address_book_items
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );
  }
}
