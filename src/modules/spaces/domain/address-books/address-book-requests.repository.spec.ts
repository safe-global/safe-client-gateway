// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Mock, MockedObject } from 'vitest';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { createMockSpaceFieldEncryptionService } from '@/modules/spaces/domain/__tests__/space-field-encryption.service.mock';
import { AddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository';

describe('AddressBookRequestsRepository', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const requestedById = faker.number.int({ min: 1, max: 100_000 });

  let spaceFieldEncryptionService: ReturnType<
    typeof createMockSpaceFieldEncryptionService
  >;
  let requestRepository: {
    find: Mock;
    findOne: Mock;
    insert: Mock;
    count: Mock;
    update: Mock;
  };
  let db: MockedObject<PostgresDatabaseService>;
  let target: AddressBookRequestsRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    spaceFieldEncryptionService = createMockSpaceFieldEncryptionService();
    requestRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      insert: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    };
    db = {
      getRepository: vi.fn().mockResolvedValue(requestRepository),
    } as unknown as MockedObject<PostgresDatabaseService>;

    target = new AddressBookRequestsRepository(db, spaceFieldEncryptionService);
  });

  describe('create', () => {
    it('encrypts the address and name before insert and returns the decrypted row', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'Alice';
      const chainIds = ['1'];
      spaceFieldEncryptionService.encryptAddressBookRequest.mockResolvedValue({
        address: 'kms:v1:a',
        name: 'kms:v1:n',
        addressIndex: 'idx',
      });
      requestRepository.insert.mockResolvedValue({ identifiers: [{ id: 5 }] });
      requestRepository.findOne.mockResolvedValue({
        id: 5,
        address: 'kms:v1:a',
        name: 'kms:v1:n',
      });
      spaceFieldEncryptionService.decryptAddressBookRequests.mockResolvedValue([
        { id: 5, address, name },
      ]);

      const result = await target.create({
        spaceId,
        requestedById,
        item: { address, name, chainIds },
      });

      expect(
        spaceFieldEncryptionService.encryptAddressBookRequest,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, { address, name });
      expect(requestRepository.insert).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          space: { id: spaceId },
          requestedBy: { id: requestedById },
          address: 'kms:v1:a',
          addressIndex: 'idx',
          name: 'kms:v1:n',
          status: 'PENDING',
        }),
      );
      expect(result.address).toBe(address);
    });
  });

  describe('findBySpaceId', () => {
    it('decrypts requests at the repository boundary', async () => {
      const rows = [{ id: 1, address: 'kms:v1:a', name: 'kms:v1:n' }];
      requestRepository.find.mockResolvedValue(rows);
      const decrypted = [
        {
          id: 1,
          address: getAddress(faker.finance.ethereumAddress()),
          name: 'Alice',
        },
      ];
      spaceFieldEncryptionService.decryptAddressBookRequests.mockResolvedValue(
        decrypted,
      );

      await expect(target.findBySpaceId({ spaceId })).resolves.toStrictEqual(
        decrypted,
      );
      expect(
        spaceFieldEncryptionService.decryptAddressBookRequests,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, rows);
    });
  });
});
