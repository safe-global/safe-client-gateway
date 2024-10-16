import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationTypes1727702843994 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "notification_types" ("name") VALUES ('CONFIRMATION_REQUEST'),('DELETED_MULTISIG_TRANSACTION'),('EXECUTED_MULTISIG_TRANSACTION'),('INCOMING_ETHER'),('INCOMING_TOKEN'),('MESSAGE_CONFIRMATION_REQUEST'),('MODULE_TRANSACTION');`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notification_types WHERE "name" IN ('CONFIRMATION_REQUEST','DELETED_MULTISIG_TRANSACTION','EXECUTED_MULTISIG_TRANSACTION','INCOMING_ETHER','INCOMING_TOKEN','MESSAGE_CONFIRMATION_REQUEST','MODULE_TRANSACTION');`,
    );
  }
}
