import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWallets1737473344288 implements MigrationInterface {
  name = 'CreateWallets1737473344288';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wallets" ("id" SERIAL NOT NULL, "address" character varying(42) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" integer NOT NULL, CONSTRAINT "UQ_wallet_address" UNIQUE ("address"), CONSTRAINT "PK_wallet_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_wallets_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_wallets_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "wallets"`);
  }
}
