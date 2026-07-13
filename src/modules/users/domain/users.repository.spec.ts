// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { IsNull, QueryFailedError } from 'typeorm';
import { getAddress } from 'viem';
import type { Mock, MockedObject } from 'vitest';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { createMockSpaceAuditRepository } from '@/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import { UserEmailAlreadyInUseError } from '@/modules/users/domain/errors/user-email-already-in-use.error';
import type { UserEncryptionService } from '@/modules/users/domain/user-encryption.service';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { createMockWalletEncryptionService } from '@/modules/wallets/domain/__tests__/wallet-encryption.service.mock';
import type { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

function uniqueConstraintError(constraint: string): QueryFailedError {
  const driverError = Object.assign(new Error('duplicate key value'), {
    code: '23505',
    constraint,
  });
  return new QueryFailedError('INSERT', [], driverError as Error);
}

describe('UsersRepository', () => {
  const walletsRepository = {
    findOneByAddress: vi.fn(),
    findOneOrFail: vi.fn(),
    deleteByAddress: vi.fn(),
  } as MockedObject<IWalletsRepository>;
  // Passthrough crypto (disabled-like): blind index null, values unchanged, so
  // existing plaintext assertions hold. Encryption + blind-index lookups are
  // covered by integration tests.
  const userEncryptionService = {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    isEncrypted: vi.fn(),
    blindIndex: vi.fn(),
    decryptUserEmails: vi.fn(),
  } as MockedObject<UserEncryptionService>;

  let postgresDatabaseService: MockedObject<PostgresDatabaseService>;
  let userRepository: {
    find: Mock;
    findOne: Mock;
    findOneOrFail: Mock;
    update: Mock;
    createQueryBuilder: Mock;
  };
  let emailUpdateExecute: Mock;
  let walletEncryptionService: MockedObject<WalletEncryptionService>;
  let target: UsersRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    // Chainable stub for persistEmail's UPDATE ... WHERE email IS NULL query.
    emailUpdateExecute = vi.fn().mockResolvedValue({ affected: 1 });
    const queryBuilder = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      execute: emailUpdateExecute,
    };

    userRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      findOneOrFail: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };

    postgresDatabaseService = {
      getRepository: vi.fn().mockResolvedValue(userRepository),
      transaction: vi.fn(),
    } as MockedObject<PostgresDatabaseService>;

    userEncryptionService.encrypt.mockImplementation((_userId, email) =>
      Promise.resolve(email),
    );
    userEncryptionService.decrypt.mockImplementation((_userId, value) =>
      Promise.resolve(value),
    );
    userEncryptionService.isEncrypted.mockReturnValue(false);
    userEncryptionService.blindIndex.mockReturnValue(null);
    // Mirrors the real batch helper, driven by the decrypt mock.
    userEncryptionService.decryptUserEmails.mockImplementation(async (users) =>
      Promise.all(
        users.map(async (user) =>
          user.email
            ? {
                ...user,
                email: await userEncryptionService.decrypt(user.id, user.email),
              }
            : user,
        ),
      ),
    );

    // Created after resetAllMocks so the passthrough implementations survive.
    walletEncryptionService = createMockWalletEncryptionService();

    target = new UsersRepository(
      postgresDatabaseService,
      walletsRepository,
      createMockSpaceAuditRepository(),
      userEncryptionService,
      walletEncryptionService,
    );
  });

  describe('findOrCreateByWalletAddress', () => {
    const mockEntityManager = (args?: {
      walletInsertIdentifiers?: Array<Record<string, unknown>>;
      createdUserId?: number;
      racedUserId?: number;
    }) => {
      const queryBuilder = {
        insert: vi.fn().mockReturnThis(),
        into: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        orIgnore: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
          identifiers: args?.walletInsertIdentifiers ?? [{ id: 1 }],
        }),
      };

      return {
        findOne: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(
            args?.racedUserId
              ? {
                  user: {
                    id: args.racedUserId,
                  },
                }
              : null,
          ),
        insert: vi.fn().mockResolvedValue({
          identifiers: [{ id: args?.createdUserId ?? 1 }],
        }),
        createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
        delete: vi.fn(),
      };
    };

    it('should use the provided entity manager instead of opening a transaction', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const createdUserId = faker.number.int({ min: 1 });
      const entityManager = mockEntityManager({ createdUserId });

      await expect(
        target.findOrCreateByWalletAddress(
          address,
          'PENDING',
          // The test only needs the EntityManager methods used by the helper.
          entityManager as never,
        ),
      ).resolves.toBe(createdUserId);

      expect(postgresDatabaseService.transaction).not.toHaveBeenCalled();
      expect(entityManager.insert).toHaveBeenCalledWith(DbUser, {
        status: 'PENDING',
      });
      expect(entityManager.delete).not.toHaveBeenCalled();
    });

    it('should delete the created user and return the racing wallet user when wallet insert is ignored', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const createdUserId = faker.number.int({ min: 1 });
      const racedUserId = faker.number.int({ min: createdUserId + 1 });
      const entityManager = mockEntityManager({
        createdUserId,
        racedUserId,
        walletInsertIdentifiers: [],
      });

      await expect(
        target.findOrCreateByWalletAddress(
          address,
          'PENDING',
          entityManager as never,
        ),
      ).resolves.toBe(racedUserId);

      expect(entityManager.delete).toHaveBeenCalledWith(DbUser, createdUserId);
    });
    it('should dual-read the wallet lookup and insert ciphertext with its blind index when an index key is configured', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const createdUserId = faker.number.int({ min: 1 });
      const entityManager = mockEntityManager({ createdUserId });
      walletEncryptionService.addressIndex.mockReturnValue('address-token');
      walletEncryptionService.encryptAddress.mockResolvedValue(
        'kms:v1:ciphertext',
      );

      await expect(
        target.findOrCreateByWalletAddress(
          address,
          'PENDING',
          entityManager as never,
        ),
      ).resolves.toBe(createdUserId);

      expect(entityManager.findOne).toHaveBeenCalledWith(Wallet, {
        where: [
          { addressIndex: 'address-token' },
          { addressIndex: IsNull(), address },
        ],
        relations: { user: true },
      });
      expect(walletEncryptionService.encryptAddress).toHaveBeenCalledWith(
        createdUserId,
        address,
      );
      const queryBuilder = entityManager.createQueryBuilder.mock.results[0]
        .value as { values: Mock };
      expect(queryBuilder.values).toHaveBeenCalledWith({
        user: { id: createdUserId },
        address: 'kms:v1:ciphertext',
        addressIndex: 'address-token',
      });
    });
  });

  describe('deleteWalletFromUser', () => {
    it('should dual-read the ownership lookup and delete by the caller plaintext address', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const userId = faker.number.int({ min: 1 });
      walletsRepository.findOneByAddress.mockResolvedValue({
        user: { id: userId, email: null },
      } as never);
      walletsRepository.findOneOrFail.mockResolvedValue({
        id: 1,
        address: 'kms:v1:ciphertext',
      } as never);
      walletEncryptionService.addressIndex.mockReturnValue('address-token');

      await target.deleteWalletFromUser({ walletAddress, authPayload });

      expect(walletsRepository.findOneOrFail).toHaveBeenCalledWith([
        { addressIndex: 'address-token', user: { id: userId } },
        {
          addressIndex: IsNull(),
          address: walletAddress,
          user: { id: userId },
        },
      ]);
      // deleteByAddress dual-reads internally from the plaintext; the stored
      // row value (possibly ciphertext) must NOT be passed back in.
      expect(walletsRepository.deleteByAddress).toHaveBeenCalledWith(
        walletAddress,
      );
    });
  });
  describe('findOrCreateByExtUserIdAndEmail', () => {
    it('should return an existing user id without re-persisting when the stored email matches', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = fakeEmailAddress();
      userRepository.findOne.mockResolvedValue({ id: userId, email });

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, email),
      ).resolves.toBe(userId);

      expect(userRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when the stored email differs from the OIDC email', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      userRepository.findOne.mockResolvedValue({
        id: userId,
        email: fakeEmailAddress(),
      });

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should backfill the email when the existing user has none', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = fakeEmailAddress();
      userRepository.findOne.mockResolvedValue({ id: userId, email: null });

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, email),
      ).resolves.toBe(userId);

      expect(emailUpdateExecute).toHaveBeenCalledTimes(1);
    });

    it('should reconcile against the row a concurrent backfill wrote when persistEmail loses the race', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = fakeEmailAddress();
      // Initial read sees no stored email, but another request backfills it
      // first: our UPDATE ... WHERE email IS NULL affects zero rows.
      userRepository.findOne.mockResolvedValue({ id: userId, email: null });
      emailUpdateExecute.mockResolvedValue({ affected: 0 });
      userRepository.findOneOrFail.mockResolvedValue({ id: userId, email });

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, email),
      ).resolves.toBe(userId);

      expect(userRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, email: true },
      });
    });

    it('should reject when the row a concurrent backfill wrote has a conflicting email', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      userRepository.findOne.mockResolvedValue({ id: userId, email: null });
      emailUpdateExecute.mockResolvedValue({ affected: 0 });
      userRepository.findOneOrFail.mockResolvedValue({
        id: userId,
        email: fakeEmailAddress(),
      });

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should create a new user and store the email when none exists', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = fakeEmailAddress();
      userRepository.findOne.mockResolvedValue(null);
      postgresDatabaseService.transaction.mockResolvedValue(userId);

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, email),
      ).resolves.toBe(userId);

      expect(postgresDatabaseService.transaction).toHaveBeenCalledTimes(1);
      expect(emailUpdateExecute).not.toHaveBeenCalled();
    });

    it('should map an email unique-constraint violation on insert to UserEmailAlreadyInUseError', async () => {
      const extUserId = faker.string.uuid();
      userRepository.findOne.mockResolvedValue(null);
      postgresDatabaseService.transaction.mockRejectedValue(
        uniqueConstraintError('idx_users_email_index'),
      );

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress()),
      ).rejects.toThrow(UserEmailAlreadyInUseError);
    });

    it('should reconcile against the racing row when a concurrent insert wins, returning its id on a matching email', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = fakeEmailAddress();
      // Lookups: extUserId → null, email → null (no placeholder to claim),
      // then INSERT loses the race and re-fetch by extUserId finds the row.
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: userId, email });
      postgresDatabaseService.transaction.mockRejectedValue(
        uniqueConstraintError('idx_users_ext_user_id'),
      );

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, email),
      ).resolves.toBe(userId);

      expect(userRepository.findOne).toHaveBeenCalledTimes(3);
    });

    it('should reject when the racing row has a conflicting email', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: userId, email: fakeEmailAddress() });
      postgresDatabaseService.transaction.mockRejectedValue(
        uniqueConstraintError('idx_users_ext_user_id'),
      );

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should claim a PENDING email-invite placeholder and flip it to ACTIVE', async () => {
      const placeholderId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = fakeEmailAddress();
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: placeholderId,
        status: 'PENDING',
        extUserId: null,
      });
      userRepository.update.mockResolvedValue({ affected: 1 });

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, email),
      ).resolves.toBe(placeholderId);

      expect(userRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: placeholderId,
          status: 'PENDING',
          extUserId: expect.anything(),
        }),
        { extUserId, status: 'ACTIVE' },
      );
      expect(postgresDatabaseService.transaction).not.toHaveBeenCalled();
    });

    it('should throw when the email belongs to an already-active user', async () => {
      const linkedUserId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: linkedUserId,
        status: 'ACTIVE',
        extUserId: faker.string.uuid(),
      });

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress()),
      ).rejects.toThrow(UserEmailAlreadyInUseError);
      expect(userRepository.update).not.toHaveBeenCalled();
      expect(postgresDatabaseService.transaction).not.toHaveBeenCalled();
    });

    it('should fall through to INSERT (and surface UserEmailAlreadyInUseError) when the claim UPDATE loses the race', async () => {
      const placeholderId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: placeholderId,
        status: 'PENDING',
        extUserId: null,
      });
      userRepository.update.mockResolvedValue({ affected: 0 });
      postgresDatabaseService.transaction.mockRejectedValue(
        uniqueConstraintError('idx_users_email_index'),
      );

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress()),
      ).rejects.toThrow(UserEmailAlreadyInUseError);
      expect(postgresDatabaseService.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('findEmailById', () => {
    it('should return the persisted email', async () => {
      const userId = faker.number.int({ min: 1 });
      const email = fakeEmailAddress();
      userRepository.findOne.mockResolvedValue({ email });

      await expect(target.findEmailById(userId)).resolves.toBe(email);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, email: true },
      });
    });

    it('should return undefined when the user has no email', async () => {
      const userId = faker.number.int({ min: 1 });
      userRepository.findOne.mockResolvedValue(null);

      await expect(target.findEmailById(userId)).resolves.toBeUndefined();
    });
  });

  describe('findEmailsByIds', () => {
    it('should return null for empty input without querying', async () => {
      await expect(target.findEmailsByIds([])).resolves.toBeNull();
      expect(userRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('find', () => {
    it('should return users matching the where clause', async () => {
      const users = [
        { id: 1, email: 'a@test.com' },
        { id: 2, email: 'b@test.com' },
      ];
      userRepository.find.mockResolvedValue(users);

      const result = await target.find({ id: 1 as never });

      expect(result).toEqual(users);
      expect(userRepository.find).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: undefined,
      });
    });

    it('should pass relations to the query', async () => {
      userRepository.find.mockResolvedValue([]);

      await target.find({ id: 1 as never }, { wallets: true });

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { wallets: true },
      });
    });

    it('should return an empty array when no users match', async () => {
      userRepository.find.mockResolvedValue([]);

      const result = await target.find({ id: 999 as never });

      expect(result).toEqual([]);
    });
  });

  describe('findByWalletAddress', () => {
    it('should decrypt an encrypted email on the wallet owner', async () => {
      const email = fakeEmailAddress();
      const encrypted = `kms:v1:${Buffer.from(email, 'utf8').toString('base64url')}`;
      const user = { id: 7, email: encrypted };
      walletsRepository.findOneByAddress.mockResolvedValue({ user } as never);
      userEncryptionService.decrypt.mockResolvedValue(email);

      const result = await target.findByWalletAddress(
        getAddress(faker.finance.ethereumAddress()),
      );

      expect(result?.email).toBe(email);
    });

    it('should return undefined when no wallet matches', async () => {
      walletsRepository.findOneByAddress.mockResolvedValue(null as never);

      await expect(
        target.findByWalletAddress(getAddress(faker.finance.ethereumAddress())),
      ).resolves.toBeUndefined();
    });
  });
});
