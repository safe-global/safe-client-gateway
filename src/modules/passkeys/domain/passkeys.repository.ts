// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { PasskeyCoordinates } from '@/modules/passkeys/datasources/entities/passkey-coordinates.entity.db';
import {
  type PasskeyRecord,
  type PasskeyRecordInput,
  type WriteOutcome,
  WriteOutcomeStatus,
} from '@/modules/passkeys/domain/entities/passkey-record.entity';
import type { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';

@Injectable()
export class PasskeysRepository implements IPasskeysRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async create(input: PasskeyRecordInput): Promise<WriteOutcome> {
    const repo = await this.getRepository();
    const inserted = await this.tryInsert(repo, input);
    if (inserted) {
      return {
        status: WriteOutcomeStatus.CREATED,
        record: this.toRecord(inserted),
      };
    }
    return this.resolveConflict(repo, input);
  }

  public async findByCredentialId(
    credentialId: Buffer,
  ): Promise<PasskeyRecord | null> {
    const repo = await this.getRepository();
    const row = await repo.findOneBy({ credentialId });
    return row ? this.toRecord(row) : null;
  }

  private getRepository(): Promise<Repository<PasskeyCoordinates>> {
    return this.postgresDatabaseService.getRepository(PasskeyCoordinates);
  }

  /**
   * Attempts to INSERT … ON CONFLICT DO NOTHING. Returns the inserted entity
   * on success, or `null` if a row with the same credentialId already exists.
   *
   * We read the inserted row from `generatedMaps[0]` rather than issuing a
   * follow-up SELECT — TypeORM populates it from the RETURNING clause and
   * runs column transformers, so the shape already matches the entity.
   */
  private async tryInsert(
    repo: Repository<PasskeyCoordinates>,
    input: PasskeyRecordInput,
  ): Promise<PasskeyCoordinates | null> {
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

    const generated = insertResult.generatedMaps[0] as
      | PasskeyCoordinates
      | undefined;
    return generated ?? null;
  }

  /**
   * Classifies an ON CONFLICT DO NOTHING no-op. The credentialId is RP-scoped
   * per WebAuthn, so any `rpId` divergence is a cross-RP collision regardless
   * of whether the coords also differ. PASSKEY_CROSS_RP_CONFLICT lets clients
   * show "this credential is registered to a different domain";
   * PASSKEY_CONFLICT covers the same-RP coord-mismatch case.
   */
  private async resolveConflict(
    repo: Repository<PasskeyCoordinates>,
    input: PasskeyRecordInput,
  ): Promise<WriteOutcome> {
    const existing = await repo.findOneBy({ credentialId: input.credentialId });
    if (!existing) {
      // Extremely unlikely: row vanished between INSERT and SELECT. Treat as
      // conflict so the caller surfaces a 409 rather than a silent 200.
      return { status: WriteOutcomeStatus.CONFLICT };
    }
    if (existing.rpId !== input.rpId) {
      return { status: WriteOutcomeStatus.CROSS_RP_CONFLICT };
    }
    if (!this.coordinatesMatch(existing, input)) {
      return { status: WriteOutcomeStatus.CONFLICT };
    }
    return {
      status: WriteOutcomeStatus.IDENTICAL,
      record: this.toRecord(existing),
    };
  }

  private coordinatesMatch(
    existing: PasskeyCoordinates,
    input: PasskeyRecordInput,
  ): boolean {
    return (
      existing.x.equals(input.x) &&
      existing.y.equals(input.y) &&
      existing.verifiers.equals(input.verifiers)
    );
  }

  private toRecord(row: PasskeyCoordinates): PasskeyRecord {
    return {
      credentialId: row.credentialId,
      x: row.x,
      y: row.y,
      verifiers: row.verifiers,
      rpId: row.rpId,
      createdAt: row.createdAt,
    };
  }
}
