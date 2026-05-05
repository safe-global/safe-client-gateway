// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { PasskeyCoordinates } from '@/modules/passkeys/datasources/entities/passkey-coordinates.entity.db';
import type {
  PasskeyRecord,
  WriteOutcome,
} from '@/modules/passkeys/domain/entities/passkey-record.entity';
import type { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';

@Injectable()
export class PasskeysRepository implements IPasskeysRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async create(record: PasskeyRecord): Promise<WriteOutcome> {
    const repo =
      await this.postgresDatabaseService.getRepository(PasskeyCoordinates);

    const insertResult = await repo
      .createQueryBuilder()
      .insert()
      .into(PasskeyCoordinates)
      .values({
        credentialId: record.credentialId,
        x: record.x,
        y: record.y,
        verifiers: record.verifiers,
        rpId: record.rpId,
      })
      .orIgnore()
      .returning('*')
      .execute();

    if (insertResult.raw.length === 1) {
      return { status: 'created', record: toRecord(insertResult.raw[0]) };
    }

    // PK conflict — re-select to distinguish identical / conflict / cross-RP.
    const existing = await repo.findOneBy({
      credentialId: record.credentialId,
    });
    if (!existing) {
      // Extremely unlikely: row vanished between INSERT and SELECT.
      // Treat as conflict so the caller surfaces a 409 rather than a silent 200.
      return { status: 'conflict' };
    }

    const coordsMatch =
      bufferEquals(existing.x, record.x) &&
      bufferEquals(existing.y, record.y) &&
      bufferEquals(existing.verifiers, record.verifiers);

    if (!coordsMatch) {
      return { status: 'conflict' };
    }
    if (existing.rpId !== record.rpId) {
      return { status: 'cross_rp_conflict' };
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
