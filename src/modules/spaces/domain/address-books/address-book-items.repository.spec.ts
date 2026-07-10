// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { In, IsNull } from 'typeorm';
import { getAddress } from 'viem';
import type { Mock, MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AddressBookItem as DbAddressBookItem } from '@/modules/spaces/datasources/address-books/entities/address-book-item.entity.db';
import { createMockSpaceFieldEncryptionService } from '@/modules/spaces/domain/__tests__/space-field-encryption.service.mock';
import { AddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository';
import { createMockSpaceAuditRepository } from '@/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

describe('AddressBookItemsRepository', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const spaceUuid = fakeUuid();
  const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
  const userId = Number(authPayload.sub);

  let configurationService: MockedObject<IConfigurationService>;
  let spaceAuditRepository: ReturnType<typeof createMockSpaceAuditRepository>;
  let spaceFieldEncryptionService: ReturnType<
    typeof createMockSpaceFieldEncryptionService
  >;
  let spacesRepository: MockedObject<ISpacesRepository>;
  let itemRepository: { findBy: Mock; count: Mock; insert: Mock; update: Mock };
  let entityManager: {
    getRepository: Mock;
    findBy: Mock;
    findOne: Mock;
    delete: Mock;
  };
  let db: MockedObject<PostgresDatabaseService>;
  let target: AddressBookItemsRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    configurationService = {
      getOrThrow: vi.fn(),
      get: vi.fn(),
    } as unknown as MockedObject<IConfigurationService>;
    configurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'spaces.addressBooks.maxItems') return 100;
      throw new Error(`Unexpected config key: ${key}`);
    });

    // Recreated after the reset so the passthrough implementations survive.
    spaceAuditRepository = createMockSpaceAuditRepository();
    spaceFieldEncryptionService = createMockSpaceFieldEncryptionService();

    itemRepository = {
      findBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      insert: vi.fn().mockResolvedValue({ identifiers: [] }),
      update: vi.fn(),
    };
    entityManager = {
      getRepository: vi.fn().mockReturnValue(itemRepository),
      findBy: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      delete: vi.fn(),
    };
    db = {
      getRepository: vi.fn().mockResolvedValue(itemRepository),
      transaction: vi.fn((fn: (em: unknown) => Promise<unknown>) =>
        fn(entityManager),
      ),
    } as unknown as MockedObject<PostgresDatabaseService>;
    spacesRepository = {
      findOneOrFail: vi
        .fn()
        .mockResolvedValue({ id: spaceId, uuid: spaceUuid }),
    } as unknown as MockedObject<ISpacesRepository>;

    target = new AddressBookItemsRepository(
      db,
      spacesRepository,
      configurationService,
      spaceAuditRepository,
      spaceFieldEncryptionService,
    );
  });

  describe('findAllBySpaceId', () => {
    it('decrypts loaded items at the repository boundary', async () => {
      const rows = [{ address: 'kms:v1:a', name: 'kms:v1:n' }];
      itemRepository.findBy.mockResolvedValue(rows);
      const decrypted = [
        { address: getAddress(faker.finance.ethereumAddress()), name: 'Alice' },
      ];
      spaceFieldEncryptionService.decryptAddressBookItems.mockResolvedValue(
        decrypted,
      );

      await expect(
        target.findAllBySpaceId({ authPayload, spaceId }),
      ).resolves.toStrictEqual(decrypted);
      expect(
        spaceFieldEncryptionService.decryptAddressBookItems,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, rows);
    });
  });

  describe('upsertMany', () => {
    it('encrypts new items before insert and records ciphertext in the audit payload', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'Alice';
      const chainIds = ['1'];
      spaceFieldEncryptionService.encryptAddressBookItem.mockResolvedValue({
        address: 'kms:v1:addr',
        name: 'kms:v1:name',
        addressIndex: 'idx',
      });

      await target.upsertMany({
        authPayload,
        spaceId,
        addressBookItems: [{ address, name, chainIds }],
      });

      expect(
        spaceFieldEncryptionService.encryptAddressBookItem,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, { address, name });
      expect(itemRepository.insert).toHaveBeenCalledExactlyOnceWith([
        expect.objectContaining({
          address: 'kms:v1:addr',
          addressIndex: 'idx',
          name: 'kms:v1:name',
          chainIds,
          createdBy: userId,
          lastUpdatedBy: userId,
        }),
      ]);
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'ADDRESS_BOOK_UPSERTED',
          payload: expect.objectContaining({
            created: [{ address: 'kms:v1:addr', name: 'kms:v1:name' }],
            updated: [],
          }),
        }),
      );
    });

    it('matches an existing encrypted row by blind index (dual-read), re-encrypts, and audits ciphertext', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'New name';
      const chainIds = ['1'];
      spaceFieldEncryptionService.itemAddressIndex.mockReturnValue('idx');
      itemRepository.findBy.mockResolvedValue([
        {
          id: 7,
          address: 'kms:v1:old',
          name: 'kms:v1:oldname',
          addressIndex: 'idx',
        },
      ]);
      spaceFieldEncryptionService.encryptAddressBookItem.mockResolvedValue({
        address: 'kms:v1:addr',
        name: 'kms:v1:name',
        addressIndex: 'idx',
      });

      await target.upsertMany({
        authPayload,
        spaceId,
        addressBookItems: [{ address, name, chainIds }],
      });

      expect(itemRepository.findBy).toHaveBeenCalledWith([
        { space: { id: spaceId }, addressIndex: In(['idx']) },
        {
          space: { id: spaceId },
          addressIndex: IsNull(),
          address: In([address]),
        },
      ]);
      expect(itemRepository.update).toHaveBeenCalledExactlyOnceWith(
        7,
        expect.objectContaining({
          address: 'kms:v1:addr',
          addressIndex: 'idx',
          name: 'kms:v1:name',
          chainIds,
          lastUpdatedBy: userId,
        }),
      );
      expect(itemRepository.insert).not.toHaveBeenCalled();
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          payload: expect.objectContaining({
            created: [],
            updated: [{ address: 'kms:v1:addr', name: 'kms:v1:name' }],
          }),
        }),
      );
    });

    it('inserts plaintext with a null index when encryption is disabled (passthrough)', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'Alice';
      const chainIds = ['1'];

      await target.upsertMany({
        authPayload,
        spaceId,
        addressBookItems: [{ address, name, chainIds }],
      });

      expect(itemRepository.insert).toHaveBeenCalledExactlyOnceWith([
        expect.objectContaining({
          address,
          name,
          addressIndex: null,
          chainIds,
        }),
      ]);
    });
  });

  describe('deleteByAddress', () => {
    it('deletes via a dual-read lookup and audits the stored (ciphertext) values', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      spaceFieldEncryptionService.itemAddressIndex.mockReturnValue('idx');
      entityManager.findOne.mockResolvedValue({
        id: 9,
        address: 'kms:v1:a',
        name: 'kms:v1:n',
      });

      await target.deleteByAddress({ authPayload, spaceId, address });

      expect(entityManager.findOne).toHaveBeenCalledExactlyOnceWith(
        DbAddressBookItem,
        {
          where: [
            { space: { id: spaceId }, addressIndex: 'idx' },
            { address, space: { id: spaceId }, addressIndex: IsNull() },
          ],
        },
      );
      expect(entityManager.delete).toHaveBeenCalledExactlyOnceWith(
        DbAddressBookItem,
        9,
      );
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'ADDRESS_BOOK_DELETED',
          payload: { address: 'kms:v1:a', name: 'kms:v1:n' },
        }),
      );
    });

    it('deletes via the plaintext arm alone when no blind-index key is configured', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      entityManager.findOne.mockResolvedValue({
        id: 9,
        address,
        name: 'Alice',
      });

      await target.deleteByAddress({ authPayload, spaceId, address });

      expect(entityManager.findOne).toHaveBeenCalledExactlyOnceWith(
        DbAddressBookItem,
        {
          where: [{ address, space: { id: spaceId }, addressIndex: IsNull() }],
        },
      );
    });
  });
});
