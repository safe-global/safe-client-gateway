// SPDX-License-Identifier: FSL-1.1-MIT
// WARNING: The down migration is destructive. Once any user has registered a
// passkey, dropping `passkey_coordinates` permanently strands their
// second-device recovery (no other source of `(x, y)` exists). Do NOT run the
// down migration in production once `FF_PASSKEYS=true`. Backup the table first.
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasskeyCoordinates1778500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE passkey_coordinates (
        id             SERIAL      NOT NULL,
        credential_id  bytea       NOT NULL,
        x              bytea       NOT NULL,
        y              bytea       NOT NULL,
        verifiers      bytea       NOT NULL,
        rp_id          text        NOT NULL,
        created_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT PK_passkey_coordinates PRIMARY KEY (id),
        CONSTRAINT UQ_PC_credential_id UNIQUE (credential_id),
        CONSTRAINT CK_PC_x_len CHECK (octet_length(x) = 32),
        CONSTRAINT CK_PC_y_len CHECK (octet_length(y) = 32),
        CONSTRAINT CK_PC_verifiers_len CHECK (octet_length(verifiers) = 22),
        CONSTRAINT CK_PC_credential_id_len CHECK (octet_length(credential_id) BETWEEN 1 AND 1023),
        CONSTRAINT CK_PC_rp_id_len CHECK (rp_id <> '' AND length(rp_id) <= 253)
      ) WITH (FILLFACTOR = 100);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS passkey_coordinates;`);
  }
}
