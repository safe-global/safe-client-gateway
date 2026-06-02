// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UserEmailAlreadyInUseError } from '@/modules/users/domain/errors/user-email-already-in-use.error';
import { UsersRepository } from '@/modules/users/domain/users.repository';
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
  const walletsRepository = {} as jest.MockedObjectDeep<IWalletsRepository>;

  let postgresDatabaseService: jest.MockedObjectDeep<PostgresDatabaseService>;
  let userRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let emailUpdateExecute: jest.Mock;
  let target: UsersRepository;

  beforeEach(() => {
    jest.resetAllMocks();

    // Chainable stub for persistEmail's UPDATE ... WHERE email IS NULL query.
    emailUpdateExecute = jest.fn().mockResolvedValue(undefined);
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: emailUpdateExecute,
    };

    userRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    postgresDatabaseService = {
      getRepository: jest.fn().mockResolvedValue(userRepository),
      transaction: jest.fn(),
    } as jest.MockedObjectDeep<PostgresDatabaseService>;

    target = new UsersRepository(postgresDatabaseService, walletsRepository);
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
        uniqueConstraintError('idx_users_email'),
      );

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress()),
      ).rejects.toThrow(UserEmailAlreadyInUseError);
    });

    it('should reconcile against the racing row when a concurrent insert wins, returning its id on a matching email', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = fakeEmailAddress();
      // First lookup finds no record, so we attempt the insert; the insert loses
      // the race and the re-fetch returns the row the concurrent request wrote.
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: userId, email });
      postgresDatabaseService.transaction.mockRejectedValue(
        uniqueConstraintError('idx_users_ext_user_id'),
      );

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, email),
      ).resolves.toBe(userId);

      expect(userRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should reject when the racing row has a conflicting email', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: userId, email: fakeEmailAddress() });
      postgresDatabaseService.transaction.mockRejectedValue(
        uniqueConstraintError('idx_users_ext_user_id'),
      );

      await expect(
        target.findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress()),
      ).rejects.toThrow(UnauthorizedException);
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
        select: { email: true },
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
});
