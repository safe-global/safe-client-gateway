// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import type { Mock, MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { createMockSpaceEncryptionService } from '@/modules/spaces/domain/__tests__/space-encryption.service.mock';
import { createMockSpaceAuditRepository } from '@/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { createMockMemberEncryptionService } from '@/modules/users/domain/members/__tests__/member-encryption.service.mock';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

describe('SpacesRepository', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const spaceUuid = fakeUuid();
  const userId = faker.number.int({ min: 1, max: 100_000 });
  const memberId = faker.number.int({ min: 1, max: 100_000 });
  const maxSpaceCreationsPerUser = faker.number.int({ min: 1, max: 100 });

  let configurationService: MockedObject<IConfigurationService>;
  let spaceAuditRepository: ReturnType<typeof createMockSpaceAuditRepository>;
  let spaceEncryptionService: ReturnType<
    typeof createMockSpaceEncryptionService
  >;
  let memberEncryptionService: ReturnType<
    typeof createMockMemberEncryptionService
  >;
  let memberRepository: { find: Mock };
  let queryBuilderSet: Mock;
  let entityManager: {
    save: Mock;
    update: Mock;
    findOne: Mock;
    delete: Mock;
    createQueryBuilder: Mock;
  };
  let postgresDatabaseService: MockedObject<PostgresDatabaseService>;
  let target: SpacesRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    configurationService = {
      getOrThrow: vi.fn(),
      get: vi.fn(),
    } as unknown as MockedObject<IConfigurationService>;
    configurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'spaces.maxSpaceCreationsPerUser')
        return maxSpaceCreationsPerUser;
      throw new Error(`Unexpected config key: ${key}`);
    });

    // Recreated after the reset so the passthrough implementations survive.
    spaceAuditRepository = createMockSpaceAuditRepository();
    spaceEncryptionService = createMockSpaceEncryptionService();
    memberEncryptionService = createMockMemberEncryptionService();

    queryBuilderSet = vi.fn().mockReturnThis();
    const queryBuilder = {
      update: vi.fn().mockReturnThis(),
      set: queryBuilderSet,
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    entityManager = {
      save: vi.fn(),
      update: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };

    // isLimited() reads the caller's uninvited memberships.
    memberRepository = { find: vi.fn().mockResolvedValue([]) };

    postgresDatabaseService = {
      getRepository: vi.fn().mockResolvedValue(memberRepository),
      transaction: vi.fn((fn: (em: unknown) => Promise<unknown>) =>
        fn(entityManager),
      ),
    } as unknown as MockedObject<PostgresDatabaseService>;

    target = new SpacesRepository(
      postgresDatabaseService,
      configurationService,
      spaceAuditRepository,
      spaceEncryptionService,
      memberEncryptionService,
    );
  });

  describe('create', () => {
    const name = faker.lorem.words();

    function mockSavedSpace(): void {
      entityManager.save.mockImplementation((space: Space) =>
        Promise.resolve(
          Object.assign(space, {
            id: spaceId,
            uuid: spaceUuid,
            members: [Object.assign(space.members[0], { id: memberId })],
          }),
        ),
      );
    }

    it('rewrites the space name and creator member name to ciphertext after save, inside the transaction', async () => {
      mockSavedSpace();
      const encryptedSpaceName = `kms:v1:${faker.string.alphanumeric(16)}`;
      const encryptedMemberName = `kms:v1:${faker.string.alphanumeric(16)}`;
      spaceEncryptionService.encryptSpaceName.mockResolvedValue(
        encryptedSpaceName,
      );
      memberEncryptionService.encryptName.mockResolvedValue(
        encryptedMemberName,
      );

      const result = await target.create({ userId, name, status: 'ACTIVE' });

      // The caller gets the plaintext back, not the ciphertext.
      expect(result).toStrictEqual({ uuid: spaceUuid, name });
      expect(
        spaceEncryptionService.encryptSpaceName,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, name);
      expect(
        memberEncryptionService.encryptName,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, `${name} creator`);
      expect(entityManager.update).toHaveBeenCalledWith(Space, spaceId, {
        name: encryptedSpaceName,
      });
      expect(entityManager.update).toHaveBeenCalledWith(Member, memberId, {
        name: encryptedMemberName,
      });
      // The audit payload reuses the ciphertext written to the row.
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'SPACE_CREATED',
          payload: { name: encryptedSpaceName },
        }),
      );
    });

    it('skips the ciphertext rewrites when encryption is disabled (passthrough)', async () => {
      mockSavedSpace();

      const result = await target.create({ userId, name, status: 'ACTIVE' });

      expect(result).toStrictEqual({ uuid: spaceUuid, name });
      expect(entityManager.update).not.toHaveBeenCalled();
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({ payload: { name } }),
      );
    });
  });

  describe('update', () => {
    it('decrypts the stored name for the diff and writes/audits ciphertext on rename', async () => {
      const storedCiphertext = `kms:v1:${faker.string.alphanumeric(16)}`;
      const decryptedName = faker.lorem.words();
      const newName = faker.lorem.words();
      const newCiphertext = `kms:v1:${faker.string.alphanumeric(16)}`;
      entityManager.findOne.mockResolvedValue({
        id: spaceId,
        uuid: spaceUuid,
        name: storedCiphertext,
        status: 'ACTIVE',
      });
      spaceEncryptionService.decryptSpaceName.mockResolvedValue(decryptedName);
      spaceEncryptionService.encryptSpaceName.mockResolvedValue(newCiphertext);

      await target.update({
        id: spaceId,
        updatePayload: { name: newName },
        actorUserId: userId,
      });

      expect(
        spaceEncryptionService.decryptSpaceName,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, storedCiphertext);
      expect(
        spaceEncryptionService.encryptSpaceName,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, newName);
      expect(queryBuilderSet).toHaveBeenCalledExactlyOnceWith({
        name: newCiphertext,
      });
      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'SPACE_UPDATED',
          // old: the previously stored ciphertext; new: the newly written
          // ciphertext — no extra KMS calls (contract pattern 5).
          payload: {
            old: { name: storedCiphertext },
            new: { name: newCiphertext },
          },
        }),
      );
    });

    it('records no name diff when the incoming name matches the decrypted stored name, but still writes ciphertext', async () => {
      const sameName = faker.lorem.words();
      const reEncrypted = `kms:v1:${faker.string.alphanumeric(16)}`;
      entityManager.findOne.mockResolvedValue({
        id: spaceId,
        uuid: spaceUuid,
        name: `kms:v1:${faker.string.alphanumeric(16)}`,
        status: 'ACTIVE',
      });
      spaceEncryptionService.decryptSpaceName.mockResolvedValue(sameName);
      spaceEncryptionService.encryptSpaceName.mockResolvedValue(reEncrypted);

      await target.update({
        id: spaceId,
        updatePayload: { name: sameName },
        actorUserId: userId,
      });

      // Never write the incoming plaintext over an encrypted row.
      expect(queryBuilderSet).toHaveBeenCalledExactlyOnceWith({
        name: reEncrypted,
      });
      expect(spaceAuditRepository.record).not.toHaveBeenCalled();
    });

    it('does not touch encryption for status-only updates', async () => {
      entityManager.findOne.mockResolvedValue({
        id: spaceId,
        uuid: spaceUuid,
        name: `kms:v1:${faker.string.alphanumeric(16)}`,
        status: 'ACTIVE',
      });

      await target.update({
        id: spaceId,
        updatePayload: { status: 'ACTIVE' },
        actorUserId: userId,
      });

      expect(spaceEncryptionService.decryptSpaceName).not.toHaveBeenCalled();
      expect(spaceEncryptionService.encryptSpaceName).not.toHaveBeenCalled();
      expect(queryBuilderSet).toHaveBeenCalledExactlyOnceWith({
        status: 'ACTIVE',
      });
      expect(spaceAuditRepository.record).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the space does not exist', async () => {
      entityManager.findOne.mockResolvedValue(null);

      await expect(
        target.update({
          id: spaceId,
          updatePayload: { name: faker.lorem.words() },
          actorUserId: userId,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('records the stored (possibly ciphertext) name in the SPACE_DELETED payload without extra KMS calls', async () => {
      const storedCiphertext = `kms:v1:${faker.string.alphanumeric(16)}`;
      entityManager.findOne.mockResolvedValue({
        id: spaceId,
        uuid: spaceUuid,
        name: storedCiphertext,
      });

      await target.delete({ id: spaceId, actorUserId: userId });

      expect(spaceAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        entityManager,
        expect.objectContaining({
          eventType: 'SPACE_DELETED',
          payload: { name: storedCiphertext },
        }),
      );
      expect(spaceEncryptionService.decryptSpaceName).not.toHaveBeenCalled();
      expect(entityManager.delete).toHaveBeenCalledWith(Space, spaceId);
    });
  });
});
