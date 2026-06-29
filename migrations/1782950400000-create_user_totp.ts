// SPDX-License-Identifier: FSL-1.1-MIT
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTotp1782950400000 implements MigrationInterface {
  name = 'CreateUserTotp1782950400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // One TOTP registration per user (shared across all of the user's
    // Workspaces). user_id is both the primary key and the FK to users.
    await queryRunner.query(
      `CREATE TABLE "user_totp" ("user_id" integer NOT NULL, "secret" character varying NOT NULL, CONSTRAINT "PK_user_totp_user_id" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_totp" ADD CONSTRAINT "FK_user_totp_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_totp" DROP CONSTRAINT "FK_user_totp_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_totp"`);
  }
}
