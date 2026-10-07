// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import configuration from '#/config/entities/__tests__/configuration';
import { postgresConfig } from '#/config/entities/postgres.config';
import { DatabaseMigrator } from '#/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '#/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { SpaceSafe } from '#/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import { createMockSpaceEncryptionService } from '#/modules/spaces/domain/__tests__/space-encryption.service.mock';
import { createMockSpaceAuditRepository } from '#/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import { SpacesRepository } from '#/modules/spaces/domain/spaces.repository';
import { Member } from '#/modules/users/datasources/entities/member.entity.db';
import { User } from '#/modules/users/datasources/entities/users.entity.db';
import { createMockUserEncryptionService } from '#/modules/users/domain/__tests__/user-encryption.service.mock';
import { createMockMemberEncryptionService } from '#/modules/users/domain/members/__tests__/member-encryption.service.mock';
import { MembersRepository } from '#/modules/users/domain/members/members.repository';
import { UsersRepository } from '#/modules/users/domain/users.repository';
import { Wallet } from '#/modules/wallets/datasources/entities/wallets.entity.db';
import { createMockWalletEncryptionService } from '#/modules/wallets/domain/__tests__/wallet-encryption.service.mock';
import { WalletsRepository } from '#/modules/wallets/domain/wallets.repository';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

// Own file: holding two connections at once disturbs sibling specs' pool.
describe('UsersRepository concurrency', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let usersRepository: UsersRepository;
  let membersRepository: MembersRepository;

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

    const walletsRepository = new WalletsRepository(
      postgresDatabaseService,
      createMockWalletEncryptionService(),
    );
    usersRepository = new UsersRepository(
      postgresDatabaseService,
      walletsRepository,
      createMockSpaceAuditRepository(),
      createMockUserEncryptionService(),
      createMockWalletEncryptionService(),
    );

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'spaces.maxSpaceCreationsPerUser',
      testConfiguration.spaces.maxSpaceCreationsPerUser,
    );
    membersRepository = new MembersRepository(
      postgresDatabaseService,
      usersRepository,
      new SpacesRepository(
        postgresDatabaseService,
        fakeConfigurationService,
        createMockSpaceAuditRepository(),
        createMockSpaceEncryptionService(),
        createMockMemberEncryptionService(),
      ),
      createMockSpaceAuditRepository(),
      walletsRepository,
      createMockUserEncryptionService(),
      createMockWalletEncryptionService(),
      createMockMemberEncryptionService(),
      mockLoggingService,
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
    await expect(
      dataSource.getRepository(User).findOneBy({ id: userId }),
    ).resolves.not.toBeNull();
  });

  it('rejects a deletion that would orphan a concurrently created space', async () => {
    const userId = await insertUser();

    const queryRunner = dataSource.createQueryRunner();
    let deletion: Promise<void> | undefined;
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      const inserted = await queryRunner.manager
        .getRepository(Space)
        .insert({ name: faker.word.noun(), status: 'ACTIVE' });
      await queryRunner.manager.getRepository(Member).insert({
        user: { id: userId },
        space: { id: inserted.identifiers[0].id as Space['id'] },
        name: faker.person.firstName(),
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: null,
      });

      deletion = usersRepository.delete(
        new AuthPayload(
          siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
        ),
      );
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        deletion.then(
          () => undefined,
          () => undefined,
        ),
        new Promise((resolve) => {
          timer = setTimeout(resolve, 250);
        }),
      ]);
      clearTimeout(timer);

      await queryRunner.commitTransaction();
    } finally {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }

    await expect(deletion).rejects.toThrow(ConflictException);
    await expect(
      dataSource.getRepository(User).findOneBy({ id: userId }),
    ).resolves.not.toBeNull();
    await expect(dataSource.getRepository(Member).find()).resolves.toHaveLength(
      1,
    );
  });

  it('makes a promotion wait for an in-flight account deletion', async () => {
    const userId = await insertUser();
    const adminUserId = await insertUser();
    const spaceId = await insertSpace();
    await insertActiveAdmin({ userId: adminUserId, spaceId });
    await dataSource.getRepository(Member).insert({
      user: { id: userId },
      space: { id: spaceId },
      name: faker.person.firstName(),
      role: 'MEMBER',
      status: 'ACTIVE',
      invitedBy: null,
    });

    const queryRunner = dataSource.createQueryRunner();
    let promotion: Promise<void> | undefined;
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await queryRunner.manager.findOne(User, {
        where: { id: userId },
        select: { id: true },
        lock: { mode: 'pessimistic_write' },
      });

      promotion = membersRepository.updateRole({
        actorUserId: adminUserId,
        spaceId,
        userId,
        role: 'ADMIN',
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        promotion.then(
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
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }

    await promotion;
  });

  it.each([
    {
      name: 'demotion',
      act: (args: {
        actorUserId: User['id'];
        userId: User['id'];
        spaceId: Space['id'];
      }): Promise<void> => {
        return membersRepository.updateRole({ ...args, role: 'MEMBER' });
      },
    },
    {
      name: 'removal',
      act: (args: {
        actorUserId: User['id'];
        userId: User['id'];
        spaceId: Space['id'];
      }): Promise<void> => {
        return membersRepository.removeUser(args);
      },
    },
  ])(
    'refuses a $name of the co-admin while the actor is leaving',
    async ({ act }) => {
      const actorUserId = await insertUser();
      const coAdminUserId = await insertUser();
      const spaceId = await insertSpace();
      const actorMemberId = await insertActiveAdmin({
        userId: actorUserId,
        spaceId,
      });
      await insertActiveAdmin({ userId: coAdminUserId, spaceId });

      const queryRunner = dataSource.createQueryRunner();
      let change: Promise<void> | undefined;
      try {
        await queryRunner.connect();
        await queryRunner.startTransaction();
        await queryRunner.manager.findOne(Space, {
          where: { id: spaceId },
          select: { id: true },
          lock: { mode: 'pessimistic_write' },
        });
        await queryRunner.manager.delete(Member, actorMemberId);

        change = act({ actorUserId, userId: coAdminUserId, spaceId });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const outcome = await Promise.race([
          change.then(
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
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        await queryRunner.release();
      }

      await expect(change).rejects.toThrow(
        new ConflictException('Cannot remove last admin.'),
      );
      await expect(
        dataSource.getRepository(Member).findOneBy({
          user: { id: coAdminUserId },
          space: { id: spaceId },
        }),
      ).resolves.toMatchObject({ role: 'ADMIN', status: 'ACTIVE' });
    },
  );
});
