// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { PasskeyCoordinates } from '@/modules/passkeys/datasources/entities/passkey-coordinates.entity.db';
import type {
  PasskeyRecord,
  PasskeyRecordInput,
  WriteOutcome,
} from '@/modules/passkeys/domain/entities/passkey-record.entity';
import type { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';

@Injectable()
export class PasskeysRepository implements IPasskeysRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async create(input: PasskeyRecordInput): Promise<WriteOutcome> {
    const repo =
      await this.postgresDatabaseService.getRepository(PasskeyCoordinates);

    const insertResult = await repo
      .createQueryBuilder()
      .insert()
      .into(PasskeyCoordinates)
      .values({
        credentialId: input.credentialId,
        x: input.x,
        y: input.y,
        verifiers: input.verifiers,
        rpId: input.rpId,
      })
      .orIgnore()
      .returning('*')
      .execute();

    if (insertResult.raw.length === 1) {
      // `insertResult.raw` carries driver-level rows (snake_case columns), not
      // entity-mapped fields, so we re-select via the entity repository to get
      // a properly mapped row before serialising. The extra round-trip is
      // negligible — the cold path is gated behind 500 ms attestation
      // verification.
      const inserted = await repo.findOneByOrFail({
        credentialId: input.credentialId,
      });
      return { status: 'created', record: toRecord(inserted) };
    }

    // PK conflict — re-select to distinguish identical / conflict / cross-RP.
    const existing = await repo.findOneBy({
      credentialId: input.credentialId,
    });
    if (!existing) {
      // Extremely unlikely: row vanished between INSERT and SELECT.
      // Treat as conflict so the caller surfaces a 409 rather than a silent 200.
      return { status: 'conflict' };
    }

    // rpId mismatch is the most specific signal — the credentialId is
    // RP-scoped per WebAuthn, so any rpId divergence is a cross-RP collision
    // regardless of whether the coords also differ. Clients that see
    // PASSKEY_CROSS_RP_CONFLICT can show "this credential is registered to a
    // different domain"; PASSKEY_CONFLICT covers the same-RP coord-mismatch
    // case ("registered with different keys").
    if (existing.rpId !== input.rpId) {
      return { status: 'cross_rp_conflict' };
    }

    const coordsMatch =
      bufferEquals(existing.x, input.x) &&
      bufferEquals(existing.y, input.y) &&
      bufferEquals(existing.verifiers, input.verifiers);

    if (!coordsMatch) {
      return { status: 'conflict' };
    }
    return { status: 'identical', record: toRecord(existing) };
  }

  public async findByCredentialId(
    credentialId: Buffer,
  ): Promise<PasskeyRecord | null> {
    const repo =
      await this.postgresDatabaseService.getRepository(PasskeyCoordinates);
    const row = await repo.findOneBy({ credentialId });
    return row ? toRecord(row) : null;
  }
}

function toRecord(row: PasskeyCoordinates): PasskeyRecord {
  return {
    credentialId: toBuffer(row.credentialId),
    x: toBuffer(row.x),
    y: toBuffer(row.y),
    verifiers: toBuffer(row.verifiers),
    rpId: row.rpId,
    createdAt: row.createdAt,
  };
}

function toBuffer(value: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

function bufferEquals(a: Buffer | Uint8Array, b: Buffer | Uint8Array): boolean {
  return toBuffer(a).equals(toBuffer(b));
}
