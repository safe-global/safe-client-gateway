// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
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
