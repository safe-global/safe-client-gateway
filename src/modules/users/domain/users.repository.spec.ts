// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { QueryFailedError } from 'typeorm';
import {
  USER_EMAIL_ALREADY_IN_USE_ERROR_CODE,
  UserEmailAlreadyInUseError,
} from '@/modules/users/domain/errors/user-email-already-in-use.error';

function createQueryBuilder(): {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  execute: jest.Mock;
} {
  return {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
}

describe('UsersRepository', () => {
  const walletsRepository = {} as jest.MockedObjectDeep<IWalletsRepository>;

  let postgresDatabaseService: jest.MockedObjectDeep<PostgresDatabaseService>;
  let userRepository: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let target: UsersRepository;

  beforeEach(() => {
    jest.resetAllMocks();

    userRepository = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    postgresDatabaseService = {
      getRepository: jest.fn().mockResolvedValue(userRepository),
      transaction: jest.fn(),
    } as jest.MockedObjectDeep<PostgresDatabaseService>;

    target = new UsersRepository(postgresDatabaseService, walletsRepository);
  });

  describe('findOrCreateByExtUserIdWithEmail', () => {
    it('should return an existing user id without email handling', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      userRepository.findOne.mockResolvedValue({ id: userId });

      await expect(
        target.findOrCreateByExtUserIdWithEmail(extUserId),
      ).resolves.toBe(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { extUserId },
      });
      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should create a user and persist a verified email', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = '  Alice.Example@Safe.Global ';
      const queryBuilder = createQueryBuilder();
      userRepository.findOne.mockResolvedValue(null);
      postgresDatabaseService.transaction.mockResolvedValue(userId);
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      await expect(
        target.findOrCreateByExtUserIdWithEmail(extUserId, {
          address: email,
          verified: true,
        }),
      ).resolves.toBe(userId);

      expect(postgresDatabaseService.transaction).toHaveBeenCalledWith(
        expect.any(Function),
      );
      expect(queryBuilder.update).toHaveBeenCalledWith(DbUser);
      expect(queryBuilder.set).toHaveBeenCalledWith({
        email: 'alice.example@safe.global',
      });
      expect(queryBuilder.where).toHaveBeenCalledWith('id = :userId', {
        userId,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('email IS NULL');
    });

    it('should return when an unverified email is unused', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = faker.internet.email();
      userRepository.findOne
        .mockResolvedValueOnce({ id: userId })
        .mockResolvedValueOnce(null);

      await expect(
        target.findOrCreateByExtUserIdWithEmail(extUserId, {
          address: email,
          verified: false,
        }),
      ).resolves.toBe(userId);

      expect(userRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: { email: email.toLowerCase() },
        select: { id: true },
      });
      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should return when an unverified email belongs to the same user', async () => {
      const userId = faker.number.int({ min: 1 });
      userRepository.findOne
        .mockResolvedValueOnce({ id: userId })
        .mockResolvedValueOnce({ id: userId });

      await expect(
        target.findOrCreateByExtUserIdWithEmail(faker.string.uuid(), {
          address: faker.internet.email(),
          verified: false,
        }),
      ).resolves.toBe(userId);
    });

    it('should throw when an unverified email belongs to a different user', async () => {
      const userId = faker.number.int({ min: 1 });
      userRepository.findOne
        .mockResolvedValueOnce({ id: userId })
        .mockResolvedValueOnce({ id: userId + 1 });

      const result = target.findOrCreateByExtUserIdWithEmail(
        faker.string.uuid(),
        { address: faker.internet.email(), verified: false },
      );

      await expect(result).rejects.toThrow(UserEmailAlreadyInUseError);
      await expect(result).rejects.toMatchObject({
        response: expect.objectContaining({
          code: USER_EMAIL_ALREADY_IN_USE_ERROR_CODE,
          statusCode: 409,
        }),
      });
    });

    it('should throw UserEmailAlreadyInUseError on duplicate email conflicts', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const queryBuilder = createQueryBuilder();
      userRepository.findOne.mockResolvedValue({ id: userId });
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      queryBuilder.execute.mockRejectedValue(
        new QueryFailedError(
          '',
          [],
          Object.assign(new Error('duplicate key'), {
            code: '23505',
            detail: 'Key (email)=(alice@example.com) already exists.',
          }),
        ),
      );

      const result = target.findOrCreateByExtUserIdWithEmail(extUserId, {
        address: faker.internet.email(),
        verified: true,
      });

      await expect(result).rejects.toThrow(UserEmailAlreadyInUseError);
      await expect(result).rejects.toMatchObject({
        response: expect.objectContaining({
          code: USER_EMAIL_ALREADY_IN_USE_ERROR_CODE,
          statusCode: 409,
        }),
      });
    });
  });

  describe('findEmailById', () => {
    it('should return the persisted email', async () => {
      const userId = faker.number.int({ min: 1 });
      const email = faker.internet.email().toLowerCase();
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
});
