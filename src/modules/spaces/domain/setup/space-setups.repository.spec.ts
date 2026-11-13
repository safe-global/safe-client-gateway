// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { EntityManager, Repository } from 'typeorm';
import { In } from 'typeorm';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import type { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { SpaceSetup as DbSpaceSetup } from '#/modules/spaces/datasources/setup/entities/space-setup.entity.db';
import { createMockSpaceEncryptionService } from '#/modules/spaces/domain/__tests__/space-encryption.service.mock';
import {
  spaceSetupBuilder,
  spaceSetupPayloadBuilder,
} from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import type {
  SpaceSetup,
  SpaceSetupRow,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { SpaceSetupsRepository } from '#/modules/spaces/domain/setup/space-setups.repository';
import { fakeUuid } from '#/validation/entities/schemas/__tests__/uuid.builder';

describe('SpaceSetupsRepository', () => {
  const leaseSeconds = faker.number.int({ min: 60, max: 300 });
  let entityManager: MockedObject<EntityManager>;
  let repository: MockedObject<Repository<DbSpaceSetup>>;
  let spaceEncryptionService: ReturnType<
    typeof createMockSpaceEncryptionService
  >;
  let postgresDatabaseService: MockedObject<PostgresDatabaseService>;
  let target: SpaceSetupsRepository;

  beforeEach(() => {
    entityManager = {
      insert: vi.fn(),
      update: vi.fn(),
      findOne: vi.fn(),
      findOneOrFail: vi.fn(),
    } as MockedObject<EntityManager>;
    repository = {
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
    } as MockedObject<Repository<DbSpaceSetup>>;
    postgresDatabaseService = {
      getRepository: vi.fn().mockResolvedValue(repository),
      transaction: vi.fn((fn: (em: EntityManager) => Promise<unknown>) =>
        fn(entityManager),
      ),
    } as MockedObject<PostgresDatabaseService>;
    spaceEncryptionService = createMockSpaceEncryptionService();
    target = new SpaceSetupsRepository(
      postgresDatabaseService,
      spaceEncryptionService,
    );
  });

  /** The row as stored: the payload as the passthrough encryption writes it. */
  function stored(setup: SpaceSetup): SpaceSetupRow {
    return { ...setup, payload: JSON.stringify(setup.payload) };
  }

  it('stores the payload encrypted under the space scope', async () => {
    const spaceId = faker.number.int({ min: 1 });
    const payload = spaceSetupPayloadBuilder().build();
    const ciphertext = `kms:v1:${faker.string.alphanumeric(32)}`;
    spaceEncryptionService.encryptSetupPayload.mockResolvedValue(ciphertext);

    await target.createPending({
      spaceId,
      paymentLinkId: null,
      payload,
      entityManager,
    });

    expect(spaceEncryptionService.encryptSetupPayload).toHaveBeenCalledWith(
      spaceId,
      payload,
    );
    expect(entityManager.insert).toHaveBeenCalledWith(DbSpaceSetup, {
      spaceId,
      paymentLinkId: null,
      payload: ciphertext,
      status: 'PENDING',
      appliedAt: null,
    });
  });

  it('decrypts and parses the payload it reads', async () => {
    const setup = spaceSetupBuilder().build();
    repository.findOne.mockResolvedValue(stored(setup));

    await expect(target.findBySpaceId(setup.spaceId)).resolves.toEqual(setup);
  });

  it('refuses a stored payload of an unknown shape', async () => {
    const setup = spaceSetupBuilder().build();
    repository.findOne.mockResolvedValue({
      ...stored(setup),
      payload: JSON.stringify({ ...setup.payload, version: 2 }),
    });

    await expect(target.findBySpaceId(setup.spaceId)).rejects.toThrow(ZodError);
  });

  it('reads the state of a setup without its payload', async () => {
    const setup = spaceSetupBuilder().build();
    const state = { status: setup.status, paymentLinkId: setup.paymentLinkId };
    repository.findOne.mockResolvedValue(
      Object.assign(new DbSpaceSetup(), state),
    );

    await expect(target.findStateBySpaceId(setup.spaceId)).resolves.toEqual(
      state,
    );
    expect(repository.findOne).toHaveBeenCalledWith({
      select: { status: true, paymentLinkId: true },
      where: { spaceId: setup.spaceId },
    });
    expect(spaceEncryptionService.decryptSetupPayload).not.toHaveBeenCalled();
  });

  it('reads a setup for update with a write lock in the caller transaction', async () => {
    const setup = spaceSetupBuilder().build();
    entityManager.findOne.mockResolvedValue(stored(setup));

    await expect(
      target.findBySpaceIdForUpdate(setup.spaceId, entityManager),
    ).resolves.toEqual(setup);
    expect(entityManager.findOne).toHaveBeenCalledWith(DbSpaceSetup, {
      where: { spaceId: setup.spaceId },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('reads no setup for update when the space has none', async () => {
    entityManager.findOne.mockResolvedValue(null);

    await expect(
      target.findBySpaceIdForUpdate(
        faker.number.int({ min: 1 }),
        entityManager,
      ),
    ).resolves.toBeNull();
  });

  it('maps the setup status of each space that has one', async () => {
    const setups = faker.helpers.multiple(() => spaceSetupBuilder().build(), {
      count: { min: 1, max: 3 },
    });
    const spaceIds = setups.map((setup) => setup.spaceId);
    repository.find.mockResolvedValue(setups.map(stored));

    const statuses = await target.findStatusesBySpaceIds(spaceIds);

    expect(statuses).toEqual(
      new Map(setups.map((setup) => [setup.spaceId, setup.status])),
    );
    expect(repository.find).toHaveBeenCalledWith({
      select: { spaceId: true, status: true },
      where: { spaceId: In(spaceIds) },
    });
  });

  it('queries nothing for an empty list of spaces', async () => {
    await expect(target.findStatusesBySpaceIds([])).resolves.toEqual(new Map());
    expect(postgresDatabaseService.getRepository).not.toHaveBeenCalled();
  });

  it('replaces the plan and the encrypted payload in the caller transaction', async () => {
    const spaceId = faker.number.int({ min: 1 });
    const paymentLinkId = faker.string.alphanumeric(16);
    const payload = spaceSetupPayloadBuilder().build();
    const ciphertext = `kms:v1:${faker.string.alphanumeric(32)}`;
    spaceEncryptionService.encryptSetupPayload.mockResolvedValue(ciphertext);

    await target.replace({ spaceId, paymentLinkId, payload, entityManager });

    expect(spaceEncryptionService.encryptSetupPayload).toHaveBeenCalledWith(
      spaceId,
      payload,
    );
    expect(entityManager.update).toHaveBeenCalledWith(
      DbSpaceSetup,
      { spaceId },
      { paymentLinkId, payload: ciphertext },
    );
  });

  it('claims a pending setup under a new claim and returns it as APPLYING', async () => {
    const setup = spaceSetupBuilder().with('status', 'PENDING').build();
    const claimed = {
      ...setup,
      status: 'APPLYING' as const,
      claimId: fakeUuid(),
    };
    entityManager.findOne.mockResolvedValue(stored(setup));
    entityManager.findOneOrFail.mockResolvedValue(stored(claimed));

    await expect(
      target.claim({ spaceId: setup.spaceId, leaseSeconds }),
    ).resolves.toEqual(claimed);
    expect(entityManager.update).toHaveBeenCalledWith(
      DbSpaceSetup,
      { spaceId: setup.spaceId },
      { status: 'APPLYING', claimId: expect.any(String) },
    );
  });

  it('claims nothing that another apply holds within its lease', async () => {
    const setup = spaceSetupBuilder()
      .with('status', 'APPLYING')
      .with('claimId', fakeUuid())
      .with('updatedAt', new Date())
      .build();
    entityManager.findOne.mockResolvedValue(stored(setup));

    await expect(
      target.claim({ spaceId: setup.spaceId, leaseSeconds }),
    ).resolves.toBeNull();
    expect(entityManager.update).not.toHaveBeenCalled();
  });

  it('claims nothing for a space without a setup', async () => {
    entityManager.findOne.mockResolvedValue(null);

    await expect(
      target.claim({ spaceId: faker.number.int({ min: 1 }), leaseSeconds }),
    ).resolves.toBeNull();
  });

  it('marks applied only the APPLYING setup that the given claim holds', async () => {
    const spaceId = faker.number.int({ min: 1 });
    const claimId = fakeUuid();
    repository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    await expect(target.markApplied({ spaceId, claimId })).resolves.toBe(true);
    expect(repository.update).toHaveBeenCalledWith(
      { spaceId, status: 'APPLYING', claimId },
      { status: 'APPLIED', appliedAt: expect.any(Function) },
    );
  });

  it('marks nothing applied once a later claim took the setup over', async () => {
    repository.update.mockResolvedValue({
      affected: 0,
      raw: [],
      generatedMaps: [],
    });

    await expect(
      target.markApplied({
        spaceId: faker.number.int({ min: 1 }),
        claimId: fakeUuid(),
      }),
    ).resolves.toBe(false);
  });
});
