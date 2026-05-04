// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import {
  EMAIL_IN_USE_ERROR_CODE,
  UserEmailAlreadyInUseError,
} from '@/modules/users/domain/errors/user-email-already-in-use.error';

describe('UsersRepository', () => {
  const walletsRepository = {} as jest.MockedObjectDeep<IWalletsRepository>;

  let postgresDatabaseService: jest.MockedObjectDeep<PostgresDatabaseService>;
  let userRepository: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let target: UsersRepository;

  beforeEach(() => {
    jest.resetAllMocks();

    userRepository = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
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
      userRepository.findOne.mockResolvedValue({ id: userId, email: null });

      await expect(
        target.findOrCreateByExtUserIdWithEmail(extUserId),
      ).resolves.toBe(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { extUserId },
        select: { email: true, id: true },
      });
    });

    it('should return an existing user id without email handling when email is already stored', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      userRepository.findOne.mockResolvedValue({
        id: userId,
        email: faker.internet.email().toLowerCase(),
      });

      await expect(
        target.findOrCreateByExtUserIdWithEmail(extUserId, {
          address: faker.internet.email(),
          verified: true,
        }),
      ).resolves.toBe(userId);

      expect(userRepository.findOne).toHaveBeenCalledTimes(1);
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
          code: EMAIL_IN_USE_ERROR_CODE,
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
