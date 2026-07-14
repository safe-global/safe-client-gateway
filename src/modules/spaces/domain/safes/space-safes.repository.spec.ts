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
  const maxSafesPerSpace = faker.number.int({ min: 1, max: 100 });

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
    } as MockedObject<IConfigurationService>;
    configurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'spaces.maxSafesPerSpace') return maxSafesPerSpace;
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
    } as MockedObject<PostgresDatabaseService>;

    target = new SpaceSafesRepository(
      postgresDatabaseService,
      configurationService,
      spaceAuditRepository,
      spaceEncryptionService,
    );
  });

  describe('create', () => {
    it('encrypts addresses and computes blind indexes before insert, and records the plaintext in the audit payload', async () => {
      const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
      const address = getAddress(faker.finance.ethereumAddress());
      const encryptedAddress = `kms:v1:${faker.string.alphanumeric(16)}`;
      const addressIndex = faker.string.hexadecimal({ length: 32 });
      spaceEncryptionService.encryptSafeAddress.mockResolvedValue(
        encryptedAddress,
      );
      spaceEncryptionService.safeAddressIndex.mockReturnValue(addressIndex);

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
          address: encryptedAddress,
          addressIndex,
        },
      ]);
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'SAFE_ADDED',
          payload: {
            safes: [{ chainId, address }],
          },
        }),
      );
    });

    it('inserts plaintext with a NULL index when encryption is disabled (passthrough)', async () => {
      const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
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
      spaceSafeRepository.count.mockResolvedValue(maxSafesPerSpace);

      await expect(
        target.create({
          spaceId,
          actorUserId,
          payload: [
            {
              chainId: faker.string.numeric({ length: { min: 1, max: 6 } }),
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).rejects.toThrow(
        `This Workspace only allows a maximum of ${maxSafesPerSpace} Safe Accounts.`,
      );
      expect(spaceEncryptionService.encryptSafeAddress).not.toHaveBeenCalled();
      expect(entityManager.insert).not.toHaveBeenCalled();
    });
  });

  describe('findBySpaceId', () => {
    it('routes loaded rows through decryptSpaceSafes (repository boundary)', async () => {
      const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
      const rows = [
        { chainId, address: `kms:v1:${faker.string.alphanumeric(16)}` },
      ];
      spaceSafeRepository.find.mockResolvedValue(rows);
      const decrypted = [
        { chainId, address: getAddress(faker.finance.ethereumAddress()) },
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
        id: faker.number.int({ min: 1, max: 100_000 }),
        chainId: faker.string.numeric({ length: { min: 1, max: 6 } }),
        address: `kms:v1:${faker.string.alphanumeric(16)}`,
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
      const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
      const row = {
        id: faker.number.int({ min: 1, max: 100_000 }),
        chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };
      spaceSafeRepository.find.mockResolvedValue([row]);

      const result = await target.find({ where: { chainId } });

      expect(result).toStrictEqual([row]);
      expect(spaceEncryptionService.decryptSpaceSafes).not.toHaveBeenCalled();
    });

    it('throws on an encrypted row whose space relation was not loaded', async () => {
      const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
      spaceSafeRepository.find.mockResolvedValue([
        {
          id: faker.number.int({ min: 1, max: 100_000 }),
          chainId,
          address: `kms:v1:${faker.string.alphanumeric(16)}`,
        },
      ]);

      await expect(target.find({ where: { chainId } })).rejects.toThrow(
        'Cannot decrypt a SpaceSafe address without its space relation loaded',
      );
    });
  });

  describe('delete', () => {
    it('looks up by blind index alone when a key is configured and audits the decrypted values', async () => {
      const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
      const address = getAddress(faker.finance.ethereumAddress());
      const addressIndex = faker.string.hexadecimal({ length: 32 });
      spaceEncryptionService.safeAddressIndex.mockReturnValue(addressIndex);
      const row = {
        id: faker.number.int({ min: 1, max: 100_000 }),
        chainId,
        address: `kms:v1:${faker.string.alphanumeric(16)}`,
      };
      entityManager.find.mockResolvedValue([row]);
      spaceEncryptionService.decryptSpaceSafes.mockResolvedValue([
        { chainId, address },
      ]);

      await target.delete({
        spaceId,
        actorUserId,
        payload: [{ chainId, address }],
      });

      expect(entityManager.find).toHaveBeenCalledExactlyOnceWith(SpaceSafe, {
        where: [{ space: { id: spaceId }, chainId, addressIndex }],
      });
      expect(entityManager.remove).toHaveBeenCalledExactlyOnceWith([row]);
      expect(
        spaceEncryptionService.decryptSpaceSafes,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, [row]);
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'SAFE_REMOVED',
          payload: { safes: [{ chainId, address }] },
        }),
      );
    });

    it('looks up by the plaintext arm alone when no blind-index key is configured', async () => {
      const chainId = faker.string.numeric({ length: { min: 1, max: 6 } });
      const address = getAddress(faker.finance.ethereumAddress());
      const row = {
        id: faker.number.int({ min: 1, max: 100_000 }),
        chainId,
        address,
      };
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
