// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import {
  EMAIL_IN_USE_ERROR_CODE,
  UserEmailAlreadyInUseError,
} from '@/modules/users/domain/errors/user-email-already-in-use.error';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

describe('UsersRepository', () => {
  const walletsRepository = {} as jest.MockedObjectDeep<IWalletsRepository>;

  let postgresDatabaseService: jest.MockedObjectDeep<PostgresDatabaseService>;
  let userRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let target: UsersRepository;

  beforeEach(() => {
    jest.resetAllMocks();

    userRepository = {
      find: jest.fn(),
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
        email: fakeEmailAddress(),
      });

      await expect(
        target.findOrCreateByExtUserIdWithEmail(extUserId, {
          address: fakeEmailAddress(),
          verified: true,
        }),
      ).resolves.toBe(userId);

      expect(userRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should return when an unverified email is unused', async () => {
      const userId = faker.number.int({ min: 1 });
      const extUserId = faker.string.uuid();
      const email = fakeEmailAddress();
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
          address: fakeEmailAddress(),
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
        { address: fakeEmailAddress(), verified: false },
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
