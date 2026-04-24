// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCounterfactualSafeUsers1777636800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE counterfactual_safe_users (
        id SERIAL NOT NULL,
        counterfactual_safe_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT PK_CFSU_id PRIMARY KEY (id),
        CONSTRAINT UQ_CFSU_cf_safe_user UNIQUE (counterfactual_safe_id, user_id),
        CONSTRAINT FK_CFSU_cf_safe_id FOREIGN KEY (counterfactual_safe_id) REFERENCES counterfactual_safes(id) ON DELETE CASCADE,
        CONSTRAINT FK_CFSU_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IDX_CFSU_user_id ON counterfactual_safe_users(user_id);`,
    );
    await queryRunner.query(
      `CREATE TRIGGER update_counterfactual_safe_users_updated_at
        BEFORE UPDATE ON counterfactual_safe_users
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );
    await queryRunner.query(
      `INSERT INTO counterfactual_safe_users (counterfactual_safe_id, user_id)
        SELECT id, creator_id FROM counterfactual_safes
        WHERE creator_id IS NOT NULL
        ON CONFLICT DO NOTHING;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS counterfactual_safe_users CASCADE;`,
    );
  }
}
