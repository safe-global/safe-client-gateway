// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { EntityManager } from 'typeorm';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import type { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { SpaceSetup as DbSpaceSetup } from '#/modules/spaces/datasources/setup/entities/space-setup.entity.db';
import { createMockSpaceEncryptionService } from '#/modules/spaces/domain/__tests__/space-encryption.service.mock';
import {
  spaceSetupBuilder,
  spaceSetupPayloadBuilder,
} from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import type { SpaceSetup } from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { SpaceSetupsRepository } from '#/modules/spaces/domain/setup/space-setups.repository';

describe('SpaceSetupsRepository', () => {
  const leaseSeconds = faker.number.int({ min: 60, max: 300 });
  let entityManager: MockedObject<EntityManager>;
  let repository: { findOne: ReturnType<typeof vi.fn> };
  let spaceEncryptionService: ReturnType<
    typeof createMockSpaceEncryptionService
  >;
  let target: SpaceSetupsRepository;

  beforeEach(() => {
    entityManager = {
      insert: vi.fn(),
      update: vi.fn(),
      findOne: vi.fn(),
    } as MockedObject<EntityManager>;
    repository = { findOne: vi.fn() };
    const postgresDatabaseService = {
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
  function stored(setup: SpaceSetup): Omit<SpaceSetup, 'payload'> & {
    payload: string;
  } {
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
      ...setup,
      payload: JSON.stringify({ ...setup.payload, version: 2 }),
    });

    await expect(target.findBySpaceId(setup.spaceId)).rejects.toThrow(ZodError);
  });

  it('claims a pending setup by moving it to APPLYING', async () => {
    const setup = spaceSetupBuilder().with('status', 'PENDING').build();
    entityManager.findOne.mockResolvedValue(stored(setup));

    await expect(
      target.claim({ spaceId: setup.spaceId, leaseSeconds }),
    ).resolves.toEqual(setup);
    expect(entityManager.update).toHaveBeenCalledWith(
      DbSpaceSetup,
      { spaceId: setup.spaceId },
      { status: 'APPLYING' },
    );
  });

  it('claims nothing that another apply holds within its lease', async () => {
    const setup = spaceSetupBuilder()
      .with('status', 'APPLYING')
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
});
