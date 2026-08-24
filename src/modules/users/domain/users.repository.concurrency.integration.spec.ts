// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { createMockSpaceAuditRepository } from '@/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { createMockUserEncryptionService } from '@/modules/users/domain/__tests__/user-encryption.service.mock';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { createMockWalletEncryptionService } from '@/modules/wallets/domain/__tests__/wallet-encryption.service.mock';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

/**
 * Separate file because proving the lock needs two connections held at once,
 * and a spec file's TypeORM pool is shared: forcing it open changes the
 * interleaving of sibling cases that await two repository calls concurrently.
 */
describe('UsersRepository concurrency', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let usersRepository: UsersRepository;

  const testDatabaseName = faker.string.alpha({ length: 10, casing: 'lower' });
  const testConfiguration = configuration();

  const dataSource = new DataSource({
    ...postgresConfig({
      ...testConfiguration.db.connection.postgres,
      type: 'postgres',
      database: testDatabaseName,
    }),
    migrationsTableName: testConfiguration.db.orm.migrationsTableName,
    entities: [Member, Space, SpaceSafe, User, Wallet],
  });

  beforeAll(async () => {
    const testDataSource = new DataSource({
      ...postgresConfig({
        ...testConfiguration.db.connection.postgres,
        type: 'postgres',
        database: 'postgres',
      }),
    });
    const testPostgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      testDataSource,
    );
    await testPostgresDatabaseService.initializeDatabaseConnection();
    await testPostgresDatabaseService
      .getDataSource()
      .query(`CREATE DATABASE ${testDatabaseName}`);
    await testPostgresDatabaseService.destroyDatabaseConnection();

    postgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      dataSource,
    );
    await postgresDatabaseService.initializeDatabaseConnection();

    const mockConfigService = {
      getOrThrow: vi.fn().mockImplementation((key: string) => {
        if (key === 'db.migrator.numberOfRetries') {
          return testConfiguration.db.migrator.numberOfRetries;
        }
        if (key === 'db.migrator.retryAfterMs') {
          return testConfiguration.db.migrator.retryAfterMs;
        }
      }),
    } as MockedObject<ConfigService>;
    await new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    ).migrate();

    usersRepository = new UsersRepository(
      postgresDatabaseService,
      new WalletsRepository(
        postgresDatabaseService,
        createMockWalletEncryptionService(),
      ),
      createMockSpaceAuditRepository(),
      createMockUserEncryptionService(),
      createMockWalletEncryptionService(),
    );
  });

  afterEach(async () => {
    await dataSource
      .getRepository(User)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(Space)
      .createQueryBuilder()
      .delete()
      .execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  const insertUser = async (): Promise<User['id']> => {
    const result = await dataSource
      .getRepository(User)
      .insert({ status: 'ACTIVE' });
    return result.identifiers[0].id as User['id'];
  };

  const insertSpace = async (): Promise<Space['id']> => {
    const result = await dataSource
      .getRepository(Space)
      .insert({ name: faker.word.noun(), status: 'ACTIVE' });
    return result.identifiers[0].id as Space['id'];
  };

  const insertActiveAdmin = async (args: {
    userId: User['id'];
    spaceId: Space['id'];
  }): Promise<Member['id']> => {
    const result = await dataSource.getRepository(Member).insert({
      user: { id: args.userId },
      space: { id: args.spaceId },
      name: faker.person.firstName(),
      role: 'ADMIN',
      status: 'ACTIVE',
      invitedBy: null,
    });
    return result.identifiers[0].id as Member['id'];
  };

  // The co-admin is mid-departure: holding the space lock, membership deleted
  // but uncommitted. A deletion reading now would still see two admins and
  // wrongly allow itself, leaving the space with none.
  it('waits for an in-flight admin change before deciding', async () => {
    const userId = await insertUser();
    const coAdminUserId = await insertUser();
    const spaceId = await insertSpace();
    await insertActiveAdmin({ userId, spaceId });
    const coAdminMemberId = await insertActiveAdmin({
      userId: coAdminUserId,
      spaceId,
    });
    const authPayload = new AuthPayload(
      siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
    );

    const queryRunner = dataSource.createQueryRunner();
    let deletion: Promise<void> | undefined;
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await queryRunner.manager.findOne(Space, {
        where: { id: spaceId },
        select: { id: true },
        lock: { mode: 'pessimistic_write' },
      });
      await queryRunner.manager.delete(Member, coAdminMemberId);

      deletion = usersRepository.delete(authPayload);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        deletion.then(
          () => 'decided',
          () => 'decided',
        ),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve('waiting'), 500);
        }),
      ]);
      clearTimeout(timer);

      expect(outcome).toBe('waiting');

      await queryRunner.commitTransaction();
    } finally {
      // A failed assertion must not leave the row locked - it blocks cleanup.
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }

    await expect(deletion).rejects.toThrow(
      new ConflictException(
        'Cannot delete account while last admin of a workspace.',
      ),
    );
    // The co-admin lost their membership, not their account, so both remain.
    await expect(
      dataSource.getRepository(User).findOneBy({ id: userId }),
    ).resolves.not.toBeNull();
  });
});
