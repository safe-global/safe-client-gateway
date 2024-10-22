import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationTypes1727702843994 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT now() as current_timestamp`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT now() as current_timestamp`);
  }
}
