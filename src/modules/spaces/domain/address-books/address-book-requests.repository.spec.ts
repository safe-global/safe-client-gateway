// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { Mock, MockedObject } from 'vitest';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { AddressBookRequest as DbAddressBookRequest } from '@/modules/spaces/datasources/address-books/entities/address-book-request.entity.db';
import { createMockSpaceEncryptionService } from '@/modules/spaces/domain/__tests__/space-encryption.service.mock';
import { AddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository';
import { createMockSpaceAuditRepository } from '@/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

describe('AddressBookRequestsRepository', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const requestedById = faker.number.int({ min: 1, max: 100_000 });

  let spaceEncryptionService: ReturnType<
    typeof createMockSpaceEncryptionService
  >;
  let spaceAuditRepository: ReturnType<typeof createMockSpaceAuditRepository>;
  let requestRepository: {
    find: Mock;
    findOne: Mock;
    count: Mock;
    update: Mock;
  };
  let entityManager: {
    getRepository: Mock;
    findBy: Mock;
    findOne: Mock;
    insert: Mock;
    delete: Mock;
  };
  let db: MockedObject<PostgresDatabaseService>;
  let target: AddressBookRequestsRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    spaceEncryptionService = createMockSpaceEncryptionService();
    spaceAuditRepository = createMockSpaceAuditRepository();

    requestRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    };
    entityManager = {
      getRepository: vi.fn().mockReturnValue(requestRepository),
      findBy: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    db = {
      getRepository: vi.fn().mockResolvedValue(requestRepository),
      transaction: vi.fn((fn: (em: unknown) => Promise<unknown>) =>
        fn(entityManager),
      ),
    } as MockedObject<PostgresDatabaseService>;

    target = new AddressBookRequestsRepository(
      db,
      spaceEncryptionService,
      spaceAuditRepository,
    );
  });

  describe('create', () => {
    it('encrypts the address and name before insert, records the audit event, and returns the decrypted row', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'Alice';
      const chainIds = ['1'];
      const spaceUuid = faker.string.uuid();

      spaceEncryptionService.encryptAddressBookRequest.mockResolvedValue({
        address: 'kms:v1:a',
        name: 'kms:v1:n',
        addressIndex: 'idx',
      });
      entityManager.findOne.mockResolvedValue({ id: spaceId, uuid: spaceUuid });
      entityManager.insert.mockResolvedValue({ identifiers: [{ id: 5 }] });
      requestRepository.findOne.mockResolvedValue({
        id: 5,
        address: 'kms:v1:a',
        name: 'kms:v1:n',
      });
      spaceEncryptionService.decryptAddressBookRequests.mockResolvedValue([
        { address, name },
      ]);

      const result = await target.create({
        spaceId,
        requestedById,
        item: { address, name, chainIds },
      });

      expect(
        spaceEncryptionService.encryptAddressBookRequest,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, { address, name });
      expect(entityManager.insert).toHaveBeenCalledExactlyOnceWith(
        DbAddressBookRequest,
        expect.objectContaining({
          space: { id: spaceId },
          requestedBy: { id: requestedById },
          address: 'kms:v1:a',
          addressIndex: 'idx',
          name: 'kms:v1:n',
          status: 'PENDING',
        }),
      );
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        {
          spaceId,
          spaceUuid,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_REQUEST_CREATED,
          actorUserId: requestedById,
          payload: { address, name },
        },
      );
      expect(result.address).toBe(address);
    });

    it('rejects with NotFoundException and writes nothing when the space does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      entityManager.findOne.mockResolvedValue(null);

      await expect(
        target.create({
          spaceId,
          requestedById,
          item: { address, name: 'Alice', chainIds: ['1'] },
        }),
      ).rejects.toThrow(NotFoundException);

      expect(entityManager.insert).not.toHaveBeenCalled();
      expect(spaceAuditRepository.record).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('flips a pending request to REJECTED and records the audit event with the decrypted values', async () => {
      const requestId = faker.number.int({ min: 1, max: 100_000 });
      const reviewedBy = faker.number.int({ min: 1, max: 100_000 });
      const spaceUuid = faker.string.uuid();
      const address = getAddress(faker.finance.ethereumAddress());
      const name = 'Alice';
      const row = { id: requestId, address: 'kms:v1:a', name: 'kms:v1:n' };
      const decrypted = [{ id: requestId, address, name }];
      entityManager.findOne.mockResolvedValue({ id: spaceId, uuid: spaceUuid });
      requestRepository.findOne.mockResolvedValue(row);
      spaceEncryptionService.decryptAddressBookRequests.mockResolvedValue(
        decrypted,
      );
      requestRepository.update.mockResolvedValue({ affected: 1 });

      await expect(
        target.reject({ id: requestId, spaceId, reviewedBy }),
      ).resolves.toBe(true);

      expect(requestRepository.findOne).toHaveBeenCalledExactlyOnceWith({
        where: { id: requestId, space: { id: spaceId } },
        relations: { requestedBy: true },
      });
      expect(requestRepository.update).toHaveBeenCalledExactlyOnceWith(
        { id: requestId, space: { id: spaceId }, status: 'PENDING' },
        { status: 'REJECTED', reviewedBy },
      );
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        {
          spaceId,
          spaceUuid,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_REQUEST_REJECTED,
          actorUserId: reviewedBy,
          payload: { address, name },
        },
      );
    });

    it('returns false and records nothing when the request is no longer pending', async () => {
      const requestId = faker.number.int({ min: 1, max: 100_000 });
      const reviewedBy = faker.number.int({ min: 1, max: 100_000 });
      const address = getAddress(faker.finance.ethereumAddress());
      entityManager.findOne.mockResolvedValue({
        id: spaceId,
        uuid: faker.string.uuid(),
      });
      const decrypted = [{ id: requestId, address, name: 'Alice' }];
      requestRepository.findOne.mockResolvedValue({
        id: requestId,
        address: 'kms:v1:a',
        name: 'kms:v1:n',
      });
      spaceEncryptionService.decryptAddressBookRequests.mockResolvedValue(
        decrypted,
      );
      requestRepository.update.mockResolvedValue({ affected: 0 });

      await expect(
        target.reject({ id: requestId, spaceId, reviewedBy }),
      ).resolves.toBe(false);

      expect(spaceAuditRepository.record).not.toHaveBeenCalled();
    });

    it('rejects with NotFoundException and writes nothing when the request does not exist', async () => {
      const requestId = faker.number.int({ min: 1, max: 100_000 });
      const reviewedBy = faker.number.int({ min: 1, max: 100_000 });
      entityManager.findOne.mockResolvedValue({
        id: spaceId,
        uuid: faker.string.uuid(),
      });
      requestRepository.findOne.mockResolvedValue(null);

      await expect(
        target.reject({ id: requestId, spaceId, reviewedBy }),
      ).rejects.toThrow(NotFoundException);

      expect(requestRepository.update).not.toHaveBeenCalled();
      expect(spaceAuditRepository.record).not.toHaveBeenCalled();
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
      spaceEncryptionService.decryptAddressBookRequests.mockResolvedValue(
        decrypted,
      );

      await expect(target.findBySpaceId({ spaceId })).resolves.toStrictEqual(
        decrypted,
      );
      expect(
        spaceEncryptionService.decryptAddressBookRequests,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, rows);
    });
  });
});
