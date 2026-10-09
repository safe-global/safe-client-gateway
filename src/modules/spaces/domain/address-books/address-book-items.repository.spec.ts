// SPDX-License-Identifier: FSL-1.1-MIT

import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { faker } from '@faker-js/faker';
import { In, IsNull } from 'typeorm';
import { getAddress } from 'viem';
import { type Mock, type MockedObject } from '#/__tests__/mocks';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import type { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { AddressBookItem as DbAddressBookItem } from '#/modules/spaces/datasources/address-books/entities/address-book-item.entity.db';
import { createMockSpaceEncryptionService } from '#/modules/spaces/domain/__tests__/space-encryption.service.mock';
import { AddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository';
import { createMockSpaceAuditRepository } from '#/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import type { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import { fakeUuid } from '#/validation/entities/schemas/__tests__/uuid.builder';

describe('AddressBookItemsRepository', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const spaceUuid = fakeUuid();
  const userId = faker.number.int({ min: 1, max: 100_000 });

  let configurationService: MockedObject<IConfigurationService>;
  let spaceAuditRepository: ReturnType<typeof createMockSpaceAuditRepository>;
  let spaceEncryptionService: ReturnType<
    typeof createMockSpaceEncryptionService
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
    jest.resetAllMocks();

    configurationService = {
      getOrThrow: jest.fn(),
      get: jest.fn(),
    } as MockedObject<IConfigurationService>;
    configurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'spaces.addressBooks.maxItems') return 100;
      throw new Error(`Unexpected config key: ${key}`);
    });

    // Recreated after the reset so the passthrough implementations survive.
    spaceAuditRepository = createMockSpaceAuditRepository();
    spaceEncryptionService = createMockSpaceEncryptionService();

    itemRepository = {
      findBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      insert: jest.fn().mockResolvedValue({ identifiers: [] }),
      update: jest.fn(),
    };
    entityManager = {
      getRepository: jest.fn().mockReturnValue(itemRepository),
      findBy: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    db = {
      getRepository: jest.fn().mockResolvedValue(itemRepository),
      transaction: jest.fn((fn: (em: unknown) => Promise<unknown>) =>
        fn(entityManager),
      ),
    } as MockedObject<PostgresDatabaseService>;
    spacesRepository = {
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: spaceId, uuid: spaceUuid }),
    } as MockedObject<ISpacesRepository>;

    target = new AddressBookItemsRepository(
      db,
      spacesRepository,
      configurationService,
      spaceAuditRepository,
      spaceEncryptionService,
    );
  });

  describe('findAllBySpaceId', () => {
    it('decrypts loaded items at the repository boundary', async () => {
      const rows = [{ address: 'kms:v1:a', name: 'kms:v1:n' }];
      itemRepository.findBy.mockResolvedValue(rows);
      const decrypted = [
        { address: getAddress(faker.finance.ethereumAddress()), name: 'Alice' },
      ];
      spaceEncryptionService.decryptAddressBookItems.mockResolvedValue(
        decrypted,
      );

      await expect(target.findAllBySpaceId(spaceId)).resolves.toStrictEqual(
        decrypted,
      );
      expect(
        spaceEncryptionService.decryptAddressBookItems,
      ).toHaveBeenCalledTimes(1);
      expect(
        spaceEncryptionService.decryptAddressBookItems,
      ).toHaveBeenCalledWith(spaceId, rows);
    });
  });

  describe('upsertMany', () => {
    it('encrypts new items before insert and records the plaintext in the audit payload', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'Alice';
      const chainIds = ['1'];
      spaceEncryptionService.encryptAddressBookItem.mockResolvedValue({
        address: 'kms:v1:addr',
        name: 'kms:v1:name',
        addressIndex: 'idx',
      });

      await target.upsertMany({
        userId,
        spaceId,
        addressBookItems: [{ address, name, chainIds }],
      });

      expect(
        spaceEncryptionService.encryptAddressBookItem,
      ).toHaveBeenCalledTimes(1);
      expect(
        spaceEncryptionService.encryptAddressBookItem,
      ).toHaveBeenCalledWith(spaceId, { address, name });
      expect(itemRepository.insert).toHaveBeenCalledTimes(1);
      expect(itemRepository.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          address: 'kms:v1:addr',
          addressIndex: 'idx',
          name: 'kms:v1:name',
          chainIds,
          createdBy: userId,
          lastUpdatedBy: userId,
        }),
      ]);
      expect(spaceAuditRepository.record).toHaveBeenCalledTimes(1);
      expect(spaceAuditRepository.record).toHaveBeenCalledWith(
        entityManager,
        expect.objectContaining({
          eventType: 'ADDRESS_BOOK_UPSERTED',
          payload: expect.objectContaining({
            created: [{ address, name }],
            updated: [],
          }),
        }),
      );
    });

    it('matches an existing encrypted row by blind index, re-encrypts, and audits the plaintext', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'New name';
      const chainIds = ['1'];
      spaceEncryptionService.itemAddressIndex.mockReturnValue('idx');
      itemRepository.findBy.mockResolvedValue([
        {
          id: 7,
          address: 'kms:v1:old',
          name: 'kms:v1:oldname',
          addressIndex: 'idx',
        },
      ]);
      spaceEncryptionService.encryptAddressBookItem.mockResolvedValue({
        address: 'kms:v1:addr',
        name: 'kms:v1:name',
        addressIndex: 'idx',
      });

      await target.upsertMany({
        userId,
        spaceId,
        addressBookItems: [{ address, name, chainIds }],
      });

      expect(itemRepository.findBy).toHaveBeenCalledWith({
        space: { id: spaceId },
        addressIndex: In(['idx']),
      });
      expect(itemRepository.update).toHaveBeenCalledTimes(1);
      expect(itemRepository.update).toHaveBeenCalledWith(
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
      expect(spaceAuditRepository.record).toHaveBeenCalledTimes(1);
      expect(spaceAuditRepository.record).toHaveBeenCalledWith(
        entityManager,
        expect.objectContaining({
          payload: expect.objectContaining({
            created: [],
            updated: [{ address, name }],
          }),
        }),
      );
    });

    it('inserts plaintext with a null index when encryption is disabled (passthrough)', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'Alice';
      const chainIds = ['1'];

      await target.upsertMany({
        userId,
        spaceId,
        addressBookItems: [{ address, name, chainIds }],
      });

      expect(itemRepository.insert).toHaveBeenCalledTimes(1);
      expect(itemRepository.insert).toHaveBeenCalledWith([
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
    it('deletes via the blind-index lookup and audits the decrypted values', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'Alice';
      spaceEncryptionService.itemAddressIndex.mockReturnValue('idx');

      const item = { id: 9, address: 'kms:v1:a', name: 'kms:v1:n' };
      const decrypted = [{ id: 9, address, name }];
      entityManager.findOne.mockResolvedValue(item);
      spaceEncryptionService.decryptAddressBookItems.mockResolvedValue(
        decrypted,
      );

      await target.deleteByAddress({ userId, spaceId, address });

      expect(entityManager.findOne).toHaveBeenCalledTimes(1);
      expect(entityManager.findOne).toHaveBeenCalledWith(DbAddressBookItem, {
        where: { space: { id: spaceId }, addressIndex: 'idx' },
      });
      expect(entityManager.delete).toHaveBeenCalledTimes(1);
      expect(entityManager.delete).toHaveBeenCalledWith(DbAddressBookItem, 9);
      expect(
        spaceEncryptionService.decryptAddressBookItems,
      ).toHaveBeenCalledTimes(1);
      expect(
        spaceEncryptionService.decryptAddressBookItems,
      ).toHaveBeenCalledWith(spaceId, [item]);
      expect(spaceAuditRepository.record).toHaveBeenCalledTimes(1);
      expect(spaceAuditRepository.record).toHaveBeenCalledWith(
        entityManager,
        expect.objectContaining({
          eventType: 'ADDRESS_BOOK_DELETED',
          payload: { address, name },
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

      await target.deleteByAddress({ userId, spaceId, address });

      expect(entityManager.findOne).toHaveBeenCalledTimes(1);
      expect(entityManager.findOne).toHaveBeenCalledWith(DbAddressBookItem, {
        where: { address, space: { id: spaceId }, addressIndex: IsNull() },
      });
    });
  });
});
