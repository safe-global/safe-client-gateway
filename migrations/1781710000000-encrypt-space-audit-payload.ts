// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Switches `space_audit_log.payload` from `jsonb` to `text`: the whole payload
 * is now serialized to JSON and encrypted as one blob under the space-scoped
 * context (a `kms:v1:...` ciphertext, or plaintext JSON when encryption is
 * disabled), replacing the previous per-field encryption. The column holds
 * exactly what KmsEncryptionService produces/consumes.
 *
 * The type change is a DDL table rewrite and does not fire the row-level
 * append-only UPDATE trigger.
 */
export class EncryptSpaceAuditPayload1781710000000
  implements MigrationInterface
{
  name = 'EncryptSpaceAuditPayload1781710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "space_audit_log" ALTER COLUMN "payload" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_audit_log" ALTER COLUMN "payload" TYPE text USING "payload"::text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ciphertext blobs are not valid JSON, so reverting to jsonb is only safe
    // once no encrypted payloads remain.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "space_audit_log" WHERE "payload" LIKE 'kms:v1:%'
        ) THEN
          RAISE EXCEPTION 'Cannot revert space_audit_log.payload to jsonb: encrypted payloads exist';
        END IF;
      END $$;`);
    await queryRunner.query(
      `ALTER TABLE "space_audit_log" ALTER COLUMN "payload" TYPE jsonb USING "payload"::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "space_audit_log" ALTER COLUMN "payload" SET DEFAULT '{}'`,
    );
  }
}
