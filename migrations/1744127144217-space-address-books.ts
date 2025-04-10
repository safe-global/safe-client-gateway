import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpaceAddressBooks1744127144217 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE space_address_book_items (
        id SERIAL NOT NULL,
        space_id INTEGER NOT NULL,
        chain_id VARCHAR(32) NOT NULL,
        address VARCHAR(42) NOT NULL,
        name VARCHAR(30) NOT NULL,
        created_by VARCHAR(42) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT PK_SABI_id PRIMARY KEY (id),
        CONSTRAINT UQ_SABI_space_id_chain_id_address UNIQUE (space_id, chain_id, address),
        CONSTRAINT FK_SABI_space_id FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_space_id ON space_address_book_items(space_id);`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_updated_at
        BEFORE UPDATE ON space_address_book_items
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS space_address_book_items CASCADE;`,
    );
  }
}
