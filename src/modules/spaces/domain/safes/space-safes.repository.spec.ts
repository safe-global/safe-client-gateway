// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { IsNull } from 'typeorm';
import { getAddress } from 'viem';
import type { Mock, MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { createMockSpaceEncryptionService } from '@/modules/spaces/domain/__tests__/space-encryption.service.mock';
import { createMockSpaceAuditRepository } from '@/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import { SpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

describe('SpaceSafesRepository', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const spaceUuid = fakeUuid();
  const actorUserId = faker.number.int({ min: 1, max: 100_000 });

  let configurationService: MockedObject<IConfigurationService>;
  let spaceAuditRepository: ReturnType<typeof createMockSpaceAuditRepository>;
  let spaceEncryptionService: ReturnType<
    typeof createMockSpaceEncryptionService
  >;
  let spaceSafeRepository: { find: Mock; count: Mock };
  let entityManager: {
    insert: Mock;
    find: Mock;
    remove: Mock;
    findOne: Mock;
  };
  let postgresDatabaseService: MockedObject<PostgresDatabaseService>;
  let target: SpaceSafesRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    configurationService = {
      getOrThrow: vi.fn(),
      get: vi.fn(),
    } as unknown as MockedObject<IConfigurationService>;
    configurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'spaces.maxSafesPerSpace') return 10;
      throw new Error(`Unexpected config key: ${key}`);
    });

    // Recreated after the reset so the passthrough implementations survive.
    spaceAuditRepository = createMockSpaceAuditRepository();
    spaceEncryptionService = createMockSpaceEncryptionService();

    spaceSafeRepository = {
      find: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    entityManager = {
      insert: vi.fn(),
      find: vi.fn(),
      remove: vi.fn(),
      // findSpaceForAuditOrFail
      findOne: vi.fn().mockResolvedValue({ id: spaceId, uuid: spaceUuid }),
    };
    postgresDatabaseService = {
      getRepository: vi.fn().mockResolvedValue(spaceSafeRepository),
      transaction: vi.fn((fn: (em: unknown) => Promise<unknown>) =>
        fn(entityManager),
      ),
    } as unknown as MockedObject<PostgresDatabaseService>;

    target = new SpaceSafesRepository(
      postgresDatabaseService,
      configurationService,
      spaceAuditRepository,
      spaceEncryptionService,
    );
  });

  describe('create', () => {
    it('encrypts addresses and computes blind indexes before insert, and reuses the ciphertext in the audit payload', async () => {
      const chainId = '1';
      const address = getAddress(faker.finance.ethereumAddress());
      spaceEncryptionService.encryptSafeAddress.mockResolvedValue(
        'kms:v1:safe-address',
      );
      spaceEncryptionService.safeAddressIndex.mockReturnValue('safe-index');

      await target.create({
        spaceId,
        actorUserId,
        payload: [{ chainId, address }],
      });

      expect(
        spaceEncryptionService.encryptSafeAddress,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, address);
      expect(entityManager.insert).toHaveBeenCalledExactlyOnceWith(SpaceSafe, [
        {
          space: { id: spaceId },
          chainId,
          address: 'kms:v1:safe-address',
          addressIndex: 'safe-index',
        },
      ]);
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'SAFE_ADDED',
          payload: {
            safes: [{ chainId, address: 'kms:v1:safe-address' }],
          },
        }),
      );
    });

    it('inserts plaintext with a NULL index when encryption is disabled (passthrough)', async () => {
      const chainId = '1';
      const address = getAddress(faker.finance.ethereumAddress());

      await target.create({
        spaceId,
        actorUserId,
        payload: [{ chainId, address }],
      });

      expect(entityManager.insert).toHaveBeenCalledExactlyOnceWith(SpaceSafe, [
        { space: { id: spaceId }, chainId, address, addressIndex: null },
      ]);
    });

    it('enforces the per-space limit from a count query before encrypting anything', async () => {
      spaceSafeRepository.count.mockResolvedValue(10);

      await expect(
        target.create({
          spaceId,
          actorUserId,
          payload: [
            {
              chainId: '1',
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).rejects.toThrow(
        'This Workspace only allows a maximum of 10 Safe Accounts.',
      );
      expect(spaceEncryptionService.encryptSafeAddress).not.toHaveBeenCalled();
      expect(entityManager.insert).not.toHaveBeenCalled();
    });
  });

  describe('findBySpaceId', () => {
    it('routes loaded rows through decryptSpaceSafes (repository boundary)', async () => {
      const rows = [{ chainId: '1', address: 'kms:v1:blob' }];
      spaceSafeRepository.find.mockResolvedValue(rows);
      const decrypted = [
        { chainId: '1', address: getAddress(faker.finance.ethereumAddress()) },
      ];
      spaceEncryptionService.decryptSpaceSafes.mockResolvedValue(decrypted);

      await expect(target.findBySpaceId(spaceId)).resolves.toStrictEqual(
        decrypted,
      );
      expect(
        spaceEncryptionService.decryptSpaceSafes,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, rows);
    });
  });

  describe('find', () => {
    it('decrypts encrypted rows via their loaded space relation', async () => {
      const plaintextAddress = getAddress(faker.finance.ethereumAddress());
      const row = {
        id: 1,
        chainId: '1',
        address: 'kms:v1:blob',
        space: { id: spaceId },
      };
      spaceSafeRepository.find.mockResolvedValue([row]);
      spaceEncryptionService.decryptSpaceSafes.mockResolvedValue([
        { ...row, address: plaintextAddress },
      ]);

      const result = await target.find({ where: { space: { id: spaceId } } });

      expect(result[0].address).toBe(plaintextAddress);
      expect(
        spaceEncryptionService.decryptSpaceSafes,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, [row]);
    });

    it('returns plaintext rows untouched without needing the space relation', async () => {
      const row = {
        id: 1,
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };
      spaceSafeRepository.find.mockResolvedValue([row]);

      const result = await target.find({ where: { chainId: '1' } });

      expect(result).toStrictEqual([row]);
      expect(spaceEncryptionService.decryptSpaceSafes).not.toHaveBeenCalled();
    });

    it('throws on an encrypted row whose space relation was not loaded', async () => {
      spaceSafeRepository.find.mockResolvedValue([
        { id: 1, chainId: '1', address: 'kms:v1:blob' },
      ]);

      await expect(target.find({ where: { chainId: '1' } })).rejects.toThrow(
        'Cannot decrypt a SpaceSafe address without its space relation loaded',
      );
    });
  });

  describe('delete', () => {
    it('looks up by blind index with a plaintext dual-read arm and audits the stored values', async () => {
      const chainId = '1';
      const address = getAddress(faker.finance.ethereumAddress());
      spaceEncryptionService.safeAddressIndex.mockReturnValue('safe-index');
      const row = { id: 3, chainId, address: 'kms:v1:blob' };
      entityManager.find.mockResolvedValue([row]);

      await target.delete({
        spaceId,
        actorUserId,
        payload: [{ chainId, address }],
      });

      expect(entityManager.find).toHaveBeenCalledExactlyOnceWith(SpaceSafe, {
        where: [
          { space: { id: spaceId }, chainId, addressIndex: 'safe-index' },
          {
            space: { id: spaceId },
            chainId,
            addressIndex: IsNull(),
            address,
          },
        ],
      });
      expect(entityManager.remove).toHaveBeenCalledExactlyOnceWith([row]);
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'SAFE_REMOVED',
          payload: { safes: [{ chainId, address: 'kms:v1:blob' }] },
        }),
      );
    });

    it('looks up by the plaintext arm alone when no blind-index key is configured', async () => {
      const chainId = '1';
      const address = getAddress(faker.finance.ethereumAddress());
      const row = { id: 3, chainId, address };
      entityManager.find.mockResolvedValue([row]);

      await target.delete({
        spaceId,
        actorUserId,
        payload: [{ chainId, address }],
      });

      expect(entityManager.find).toHaveBeenCalledExactlyOnceWith(SpaceSafe, {
        where: [
          {
            space: { id: spaceId },
            chainId,
            addressIndex: IsNull(),
            address,
          },
        ],
      });
    });
  });
});
