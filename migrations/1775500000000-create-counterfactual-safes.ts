// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCounterfactualSafes1775500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the orphaned table left over from the deprecated Knex "accounts"
    // module (removed in #2804). That schema is incompatible with the one
    // below and its FK target (accounts) no longer exists.
    await queryRunner.query(
      `DROP TABLE IF EXISTS counterfactual_safes CASCADE;`,
    );
    await queryRunner.query(
      `CREATE TABLE counterfactual_safes (
        id SERIAL NOT NULL,
        creator_id INTEGER,
        chain_id VARCHAR(78) NOT NULL,
        address VARCHAR(42) NOT NULL,
        factory_address VARCHAR(42) NOT NULL,
        master_copy VARCHAR(42) NOT NULL,
        salt_nonce VARCHAR(78) NOT NULL,
        safe_version VARCHAR(20) NOT NULL,
        threshold INTEGER NOT NULL,
        owners JSONB NOT NULL,
        fallback_handler VARCHAR(42),
        setup_to VARCHAR(42),
        setup_data TEXT NOT NULL,
        payment_token VARCHAR(42),
        payment NUMERIC,
        payment_receiver VARCHAR(42),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT PK_CFS_id PRIMARY KEY (id),
        CONSTRAINT UQ_CFS_chainId_address UNIQUE (chain_id, address),
        CONSTRAINT FK_CFS_creator_id FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IDX_CFS_creator_id ON counterfactual_safes(creator_id);`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_counterfactual_safes_updated_at
        BEFORE UPDATE ON counterfactual_safes
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS counterfactual_safes CASCADE;`,
    );
  }
}
