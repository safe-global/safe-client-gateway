import { MigrationInterface, QueryRunner } from "typeorm";

export class NewAddTargetedSafeChainId1764168810234 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE targeted_safes
                ADD COLUMN chain_id VARCHAR(32) NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE targeted_safes
                DROP CONSTRAINT IF EXISTS unique_targeted_safe;
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX unique_targeted_safe_with_chain
                ON targeted_safes (address, outreach_id, chain_id)
                WHERE chain_id IS NOT NULL;
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX unique_targeted_safe_without_chain
                ON targeted_safes (address, outreach_id)
                WHERE chain_id IS NULL;
        `);

        await queryRunner.query(`
            CREATE EXTENSION IF NOT EXISTS btree_gist;
        `);

        await queryRunner.query(`
            ALTER TABLE targeted_safes
                ADD CONSTRAINT prevent_mixed_chain_id
                EXCLUDE USING gist (
                    address WITH =,
                    outreach_id WITH =,
                    (CASE WHEN chain_id IS NULL THEN 0 ELSE 1 END) WITH <>
                );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE targeted_safes
                DROP CONSTRAINT IF EXISTS prevent_mixed_chain_id;
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS unique_targeted_safe_without_chain;
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS unique_targeted_safe_with_chain;
        `);

        await queryRunner.query(`
            ALTER TABLE targeted_safes
                DROP COLUMN IF EXISTS chain_id;
        `);

        await queryRunner.query(`
            ALTER TABLE targeted_safes
                ADD CONSTRAINT unique_targeted_safe
                UNIQUE (address, outreach_id);
        `);
    }
}
