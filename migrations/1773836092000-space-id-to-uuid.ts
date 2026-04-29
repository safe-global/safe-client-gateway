// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SpaceIdToUuid1773836092000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add-backfill-swap: PG can't ALTER int→uuid in-place, so we add
    // new uuid columns, backfill from the old int FKs, then drop+rename.
    await queryRunner.query(`
      -- 1. Add uuid column to spaces
      ALTER TABLE spaces ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid();

      -- 2. Add space_uuid columns to child tables
      ALTER TABLE members ADD COLUMN space_uuid UUID;
      ALTER TABLE space_safes ADD COLUMN space_uuid UUID;
      ALTER TABLE space_address_book_items ADD COLUMN space_uuid UUID;

      -- 3. Backfill FK columns via JOIN on old int FK
      UPDATE members m SET space_uuid = s.uuid FROM spaces s WHERE m.space_id = s.id;
      UPDATE space_safes ss SET space_uuid = s.uuid FROM spaces s WHERE ss.space_id = s.id;
      UPDATE space_address_book_items sabi SET space_uuid = s.uuid FROM spaces s WHERE sabi.space_id = s.id;

      -- 4. Set NOT NULL on new FK columns
      ALTER TABLE members ALTER COLUMN space_uuid SET NOT NULL;
      ALTER TABLE space_safes ALTER COLUMN space_uuid SET NOT NULL;
      ALTER TABLE space_address_book_items ALTER COLUMN space_uuid SET NOT NULL;

      -- 5. Drop FK constraints
      -- FK_members_space_id and FK_SS_space_id were renamed with quotes (case preserved).
      -- fk_sabi_space_id was created unquoted (PG folds to lowercase).
      ALTER TABLE members DROP CONSTRAINT "FK_members_space_id";
      ALTER TABLE space_safes DROP CONSTRAINT "FK_SS_space_id";
      ALTER TABLE space_address_book_items DROP CONSTRAINT "fk_sabi_space_id";

      -- 6. Drop unique constraints/indexes
      -- UQ_members_user_space was renamed with quotes (case preserved) as a constraint.
      -- uq_ss_chainid_address_space was created via CREATE UNIQUE INDEX (not ADD CONSTRAINT),
      -- so it must be dropped with DROP INDEX, not DROP CONSTRAINT.
      -- uq_sabi_space_id_address was created as a table constraint (unquoted → lowercase).
      ALTER TABLE members DROP CONSTRAINT "UQ_members_user_space";
      DROP INDEX "uq_ss_chainid_address_space";
      ALTER TABLE space_address_book_items DROP CONSTRAINT "uq_sabi_space_id_address";

      -- 7. Drop index (created unquoted → PG folds to lowercase)
      DROP INDEX "idx_sabi_space_id";

      -- 8. Drop PK
      ALTER TABLE spaces DROP CONSTRAINT "PK_spaces_id";

      -- 9. Drop old int columns
      ALTER TABLE spaces DROP COLUMN id;
      ALTER TABLE members DROP COLUMN space_id;
      ALTER TABLE space_safes DROP COLUMN space_id;
      ALTER TABLE space_address_book_items DROP COLUMN space_id;

      -- 10. Drop orphaned sequence
      DROP SEQUENCE IF EXISTS spaces_id_seq;

      -- 11. Rename columns
      ALTER TABLE spaces RENAME COLUMN uuid TO id;
      ALTER TABLE members RENAME COLUMN space_uuid TO space_id;
      ALTER TABLE space_safes RENAME COLUMN space_uuid TO space_id;
      ALTER TABLE space_address_book_items RENAME COLUMN space_uuid TO space_id;

      -- 12. Recreate PK
      ALTER TABLE spaces ADD CONSTRAINT "PK_spaces_id" PRIMARY KEY (id);

      -- 13. Recreate FKs with ON DELETE CASCADE
      ALTER TABLE members ADD CONSTRAINT "FK_members_space_id"
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
      ALTER TABLE space_safes ADD CONSTRAINT "FK_SS_space_id"
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
      ALTER TABLE space_address_book_items ADD CONSTRAINT "FK_SABI_space_id"
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

      -- 14. Recreate unique constraints
      ALTER TABLE members ADD CONSTRAINT "UQ_members_user_space"
        UNIQUE (user_id, space_id);
      ALTER TABLE space_safes ADD CONSTRAINT "UQ_SS_chainId_address_space"
        UNIQUE (chain_id, address, space_id);
      ALTER TABLE space_address_book_items ADD CONSTRAINT "UQ_SABI_space_id_address"
        UNIQUE (space_id, address);

      -- 15. Recreate index
      CREATE INDEX "IDX_SABI_space_id" ON space_address_book_items(space_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- 1. Add serial int column back to spaces
      ALTER TABLE spaces ADD COLUMN int_id SERIAL;

      -- 2. Add int space_id columns to child tables
      ALTER TABLE members ADD COLUMN int_space_id INT;
      ALTER TABLE space_safes ADD COLUMN int_space_id INT;
      ALTER TABLE space_address_book_items ADD COLUMN int_space_id INT;

      -- 3. Backfill int FK columns
      UPDATE members m SET int_space_id = s.int_id FROM spaces s WHERE m.space_id = s.id;
      UPDATE space_safes ss SET int_space_id = s.int_id FROM spaces s WHERE ss.space_id = s.id;
      UPDATE space_address_book_items sabi SET int_space_id = s.int_id FROM spaces s WHERE sabi.space_id = s.id;

      -- 4. Set NOT NULL on new int FK columns
      ALTER TABLE members ALTER COLUMN int_space_id SET NOT NULL;
      ALTER TABLE space_safes ALTER COLUMN int_space_id SET NOT NULL;
      ALTER TABLE space_address_book_items ALTER COLUMN int_space_id SET NOT NULL;

      -- 5. Drop FK constraints
      ALTER TABLE members DROP CONSTRAINT "FK_members_space_id";
      ALTER TABLE space_safes DROP CONSTRAINT "FK_SS_space_id";
      ALTER TABLE space_address_book_items DROP CONSTRAINT "FK_SABI_space_id";

      -- 6. Drop unique constraints
      ALTER TABLE members DROP CONSTRAINT "UQ_members_user_space";
      ALTER TABLE space_safes DROP CONSTRAINT "UQ_SS_chainId_address_space";
      ALTER TABLE space_address_book_items DROP CONSTRAINT "UQ_SABI_space_id_address";

      -- 7. Drop index
      DROP INDEX "IDX_SABI_space_id";

      -- 8. Drop PK
      ALTER TABLE spaces DROP CONSTRAINT "PK_spaces_id";

      -- 9. Drop uuid columns
      ALTER TABLE spaces DROP COLUMN id;
      ALTER TABLE members DROP COLUMN space_id;
      ALTER TABLE space_safes DROP COLUMN space_id;
      ALTER TABLE space_address_book_items DROP COLUMN space_id;

      -- 10. Rename int columns back
      ALTER TABLE spaces RENAME COLUMN int_id TO id;
      ALTER TABLE members RENAME COLUMN int_space_id TO space_id;
      ALTER TABLE space_safes RENAME COLUMN int_space_id TO space_id;
      ALTER TABLE space_address_book_items RENAME COLUMN int_space_id TO space_id;

      -- 11. Recreate PK
      ALTER TABLE spaces ADD CONSTRAINT "PK_spaces_id" PRIMARY KEY (id);

      -- 12. Recreate FKs with ON DELETE CASCADE
      ALTER TABLE members ADD CONSTRAINT "FK_members_space_id"
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
      ALTER TABLE space_safes ADD CONSTRAINT "FK_SS_space_id"
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
      ALTER TABLE space_address_book_items ADD CONSTRAINT "FK_SABI_space_id"
        FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

      -- 13. Recreate unique constraints
      ALTER TABLE members ADD CONSTRAINT "UQ_members_user_space"
        UNIQUE (user_id, space_id);
      ALTER TABLE space_safes ADD CONSTRAINT "UQ_SS_chainId_address_space"
        UNIQUE (chain_id, address, space_id);
      ALTER TABLE space_address_book_items ADD CONSTRAINT "UQ_SABI_space_id_address"
        UNIQUE (space_id, address);

      -- 14. Recreate index
      CREATE INDEX "IDX_SABI_space_id" ON space_address_book_items(space_id);
    `);
  }
}
