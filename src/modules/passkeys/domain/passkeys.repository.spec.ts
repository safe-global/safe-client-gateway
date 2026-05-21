// SPDX-License-Identifier: FSL-1.1-MIT
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { PasskeyCoordinates } from '@/modules/passkeys/datasources/entities/passkey-coordinates.entity.db';
import {
  type PasskeyRecordInput,
  WriteOutcomeStatus,
} from '@/modules/passkeys/domain/entities/passkey-record.entity';
import { PasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository';

interface FakeQueryBuilder {
  insert: jest.Mock;
  into: jest.Mock;
  values: jest.Mock;
  orIgnore: jest.Mock;
  returning: jest.Mock;
  execute: jest.Mock;
}

interface FakeTypeOrmRepo {
  createQueryBuilder: () => FakeQueryBuilder;
  findOneBy: jest.Mock;
}

function buildFakeQueryBuilder(executeResult: {
  generatedMaps: Array<Partial<PasskeyCoordinates>>;
}): FakeQueryBuilder {
  const qb: Partial<FakeQueryBuilder> = {};
  qb.insert = jest.fn().mockReturnValue(qb);
  qb.into = jest.fn().mockReturnValue(qb);
  qb.values = jest.fn().mockReturnValue(qb);
  qb.orIgnore = jest.fn().mockReturnValue(qb);
  qb.returning = jest.fn().mockReturnValue(qb);
  qb.execute = jest.fn().mockResolvedValue(executeResult);
  return qb as FakeQueryBuilder;
}

function buildHarness(args: {
  inserted?: PasskeyCoordinates | null;
  existing?: PasskeyCoordinates | null;
}): {
  service: PasskeysRepository;
  fakeRepo: FakeTypeOrmRepo;
  qb: FakeQueryBuilder;
} {
  const qb = buildFakeQueryBuilder({
    generatedMaps: args.inserted ? [args.inserted] : [],
  });
  const fakeRepo: FakeTypeOrmRepo = {
    createQueryBuilder: () => qb,
    findOneBy: jest.fn().mockResolvedValue(args.existing ?? null),
  };
  const fakeDb = {
    getRepository: jest.fn().mockResolvedValue(fakeRepo),
  } as unknown as PostgresDatabaseService;
  return { service: new PasskeysRepository(fakeDb), fakeRepo, qb };
}

function input(
  overrides: Partial<PasskeyRecordInput> = {},
): PasskeyRecordInput {
  return {
    credentialId: Buffer.from('credid'),
    x: Buffer.alloc(32, 0xab),
    y: Buffer.alloc(32, 0xcd),
    verifiers: Buffer.alloc(22, 0x01),
    rpId: 'app.safe.global',
    ...overrides,
  };
}

function row(overrides: Partial<PasskeyCoordinates> = {}): PasskeyCoordinates {
  return {
    id: 1,
    credentialId: Buffer.from('credid'),
    x: Buffer.alloc(32, 0xab),
    y: Buffer.alloc(32, 0xcd),
    verifiers: Buffer.alloc(22, 0x01),
    rpId: 'app.safe.global',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('PasskeysRepository.create', () => {
  it('returns "created" using the entity-mapped row from generatedMaps', async () => {
    // The column transformer on the entity (databaseBufferTransformer) lets
    // TypeORM populate `generatedMaps[0]` directly from the RETURNING clause
    // with entity-shaped fields, so no follow-up SELECT is needed.
    const inserted = row();
    const { service, fakeRepo } = buildHarness({ inserted });

    const outcome = await service.create(input());

    expect(outcome.status).toBe(WriteOutcomeStatus.CREATED);
    expect(fakeRepo.findOneBy).not.toHaveBeenCalled();
    if (outcome.status === WriteOutcomeStatus.CREATED) {
      expect(outcome.record.createdAt).toEqual(inserted.createdAt);
    }
  });

  it('returns "identical" when the existing row matches on every field', async () => {
    const existing = row();
    const { service } = buildHarness({ existing });

    const outcome = await service.create(input());
    expect(outcome.status).toBe(WriteOutcomeStatus.IDENTICAL);
  });

  it('returns "cross_rp_conflict" when only rpId differs', async () => {
    const existing = row({ rpId: 'safe.global' });
    const { service } = buildHarness({ existing });

    const outcome = await service.create(input({ rpId: 'app.safe.global' }));
    expect(outcome.status).toBe(WriteOutcomeStatus.CROSS_RP_CONFLICT);
  });

  it('returns "cross_rp_conflict" when rpId differs AND coords differ', async () => {
    // Refined semantics: rpId mismatch is the most specific signal regardless
    // of coordinate state, so the client can show a "different domain"
    // message rather than a generic "wrong credentials" one.
    const existing = row({
      rpId: 'safe.global',
      x: Buffer.alloc(32, 0xee),
    });
    const { service } = buildHarness({ existing });

    const outcome = await service.create(input({ rpId: 'app.safe.global' }));
    expect(outcome.status).toBe(WriteOutcomeStatus.CROSS_RP_CONFLICT);
  });

  it('returns "conflict" when same RP but coords differ', async () => {
    const existing = row({ x: Buffer.alloc(32, 0xee) });
    const { service } = buildHarness({ existing });

    const outcome = await service.create(input());
    expect(outcome.status).toBe(WriteOutcomeStatus.CONFLICT);
  });

  it('returns "conflict" when the row vanished between INSERT and SELECT', async () => {
    // Defensive: ON CONFLICT DO NOTHING returned 0 rows AND a follow-up
    // findOneBy also returns null. Surface a 409 so the caller does not
    // silently treat this as success.
    const { service } = buildHarness({ existing: null });

    const outcome = await service.create(input());
    expect(outcome.status).toBe(WriteOutcomeStatus.CONFLICT);
  });
});
