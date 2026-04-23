// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ConflictException } from '@nestjs/common';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

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
    } as unknown as jest.MockedObjectDeep<PostgresDatabaseService>;

    target = new UsersRepository(postgresDatabaseService, walletsRepository);
  });

  describe('persistVerifiedEmail', () => {
    it('should persist a normalized email for a user without email', async () => {
      const userId = faker.number.int({ min: 1 });
      const email = '  Alice.Example@Safe.Global ';
      const queryBuilder = createQueryBuilder();
      userRepository.findOneOrFail.mockResolvedValue({
        id: userId,
        email: null,
      });
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      await target.persistVerifiedEmail(userId, email);

      expect(queryBuilder.update).toHaveBeenCalledWith(DbUser);
      expect(queryBuilder.set).toHaveBeenCalledWith({
        email: 'alice.example@safe.global',
      });
      expect(queryBuilder.where).toHaveBeenCalledWith('id = :userId', {
        userId,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('email IS NULL');
    });

    it('should not overwrite an existing email', async () => {
      const userId = faker.number.int({ min: 1 });
      userRepository.findOneOrFail.mockResolvedValue({
        id: userId,
        email: faker.internet.email().toLowerCase(),
      });

      await target.persistVerifiedEmail(userId, faker.internet.email());

      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate email conflicts', async () => {
      const userId = faker.number.int({ min: 1 });
      const queryBuilder = createQueryBuilder();
      userRepository.findOneOrFail.mockResolvedValue({
        id: userId,
        email: null,
      });
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      queryBuilder.execute.mockRejectedValue(
        new Error(
          'duplicate key value violates unique constraint "users_email_key"',
        ),
      );

      await expect(
        target.persistVerifiedEmail(userId, faker.internet.email()),
      ).rejects.toThrow(ConflictException);
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
