// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import {
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';
import { MembersRepository } from '@/modules/users/domain/members.repository';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const UserStatusKeys = getStringEnumKeys(UserStatus);
const SpaceStatusKeys = getStringEnumKeys(SpaceStatus);
const MemberRoleKeys = getStringEnumKeys(MemberRole);
const MemberStatusKeys = getStringEnumKeys(MemberStatus);

describe('MembersRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let membersRepository: MembersRepository;

  const testDatabaseName = faker.string.alpha({
    length: 10,
    casing: 'lower',
  });
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

  const dbWalletRepo = dataSource.getRepository(Wallet);
  const dbUserRepo = dataSource.getRepository(User);
  const dbMembersRepository = dataSource.getRepository(Member);
  const dbSpacesRepository = dataSource.getRepository(Space);

  beforeAll(async () => {
    // Create database
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

    // Create database connection
    postgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      dataSource,
    );
    await postgresDatabaseService.initializeDatabaseConnection();

    // Migrate database
    const mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'db.migrator.numberOfRetries') {
          return testConfiguration.db.migrator.numberOfRetries;
        }
        if (key === 'db.migrator.retryAfterMs') {
          return testConfiguration.db.migrator.retryAfterMs;
        }
      }),
    } as jest.MockedObjectDeep<ConfigService>;
    const migrator = new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    );
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'spaces.maxSpaceCreationsPerUser') {
        return testConfiguration.spaces.maxSpaceCreationsPerUser;
      }
    });
    const walletsRepo = new WalletsRepository(postgresDatabaseService);
    membersRepository = new MembersRepository(
      postgresDatabaseService,
      new UsersRepository(postgresDatabaseService, walletsRepo),
      new SpacesRepository(postgresDatabaseService, mockConfigurationService),
      walletsRepo,
    );
  });

  afterEach(async () => {
    jest.resetAllMocks();

    // Delete in dependency order to avoid deadlocks
    await dataSource
      .getRepository(Member)
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await dataSource
      .getRepository(Space)
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await dataSource
      .getRepository(Wallet)
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await dataSource
      .getRepository(User)
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  // As the triggers are set on the database level, Jest's fake timers are not accurate
  describe('createdAt/updatedAt', () => {
    it('should set createdAt and updatedAt when creating a member', async () => {
      const before = Date.now();

      const dbUserRepo = dataSource.getRepository(User);
      const dbSpacesRepository = dataSource.getRepository(Space);
      const dbMembersRepository = dataSource.getRepository(Member);
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const space = await dbSpacesRepository.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });
      const member = await dbMembersRepository.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: faker.person.firstName(),
        status: faker.helpers.arrayElement(MemberStatusKeys),
        role: faker.helpers.arrayElement(MemberRoleKeys),
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      const after = Date.now();

      const createdAt = member.generatedMaps[0].createdAt;
      const updatedAt = member.generatedMaps[0].updatedAt;

      if (!(createdAt instanceof Date && updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt).toEqual(updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(createdAt.getTime()).toBeLessThanOrEqual(after);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a member', async () => {
      const dbUserRepo = dataSource.getRepository(User);
      const dbSpacesRepository = dataSource.getRepository(Space);
      const dbMembersRepository = dataSource.getRepository(Member);
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const space = await dbSpacesRepository.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });
      const prevMember = await dbMembersRepository.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: faker.person.firstName(),
        status: 'ACTIVE',
        role: faker.helpers.arrayElement(MemberRoleKeys),
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      const memberId = prevMember.identifiers[0].id as User['id'];
      await dbMembersRepository.update(memberId, {
        status: 'DECLINED',
      });
      const updatedMember = await dbMembersRepository.findOneOrFail({
        where: { id: memberId },
      });

      const prevUpdatedAt = prevMember.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(
        updatedMember.updatedAt.getTime(),
      );
    });
  });

  describe('findOneOrFail', () => {
    it('should find a member', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const memberName = nameBuilder();
      const memberStatus = faker.helpers.arrayElement(MemberStatusKeys);
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: spaceStatus,
      });
      const member = await dbMembersRepository.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        status: memberStatus,
        role: memberRole,
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.findOneOrFail({ id: memberId }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: memberId,
        name: memberName,
        alias: null,
        role: memberRole,
        status: memberStatus,
        invitedBy: memberInvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the member does not exist', async () => {
      const memberId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.findOneOrFail({ id: memberId }),
      ).rejects.toThrow('Member not found.');
    });
  });

  describe('findOne', () => {
    it('should find a member', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const memberName = nameBuilder();
      const memberStatus = faker.helpers.arrayElement(MemberStatusKeys);
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: spaceStatus,
      });
      const member = await dbMembersRepository.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        status: memberStatus,
        role: memberRole,
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.findOne({ id: memberId }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: memberId,
        name: memberName,
        alias: null,
        role: memberRole,
        status: memberStatus,
        invitedBy: memberInvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should return null if the member does not exist', async () => {
      const memberId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.findOne({ id: memberId }),
      ).resolves.toBeNull();
    });
  });

  describe('findOrFail', () => {
    it('should find members', async () => {
      const userStatus1 = faker.helpers.arrayElement(UserStatusKeys);
      const userStatus2 = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const memberName1 = faker.word.noun();
      const memberName2 = faker.word.noun();
      const memberStatus1 = faker.helpers.arrayElement(MemberStatusKeys);
      const memberStatus2 = faker.helpers.arrayElement(MemberStatusKeys);
      const memberRole1 = faker.helpers.arrayElement(MemberRoleKeys);
      const memberRole2 = faker.helpers.arrayElement(MemberRoleKeys);
      const member1InvitedBy = getAddress(faker.finance.ethereumAddress());
      const member2InvitedBy = getAddress(faker.finance.ethereumAddress());
      const user1 = await dbUserRepo.insert({
        status: userStatus1,
      });
      const user2 = await dbUserRepo.insert({
        status: userStatus2,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: spaceStatus,
      });
      const member1 = await dbMembersRepository.insert({
        user: user1.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName1,
        status: memberStatus1,
        role: memberRole1,
        invitedBy: member1InvitedBy,
      });
      const memberId1 = member1.identifiers[0].id as Member['id'];
      const member2 = await dbMembersRepository.insert({
        user: user2.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName2,
        status: memberStatus2,
        role: memberRole2,
        invitedBy: member2InvitedBy,
      });
      const memberId2 = member2.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.findOrFail({
          where: { id: In([memberId1, memberId2]) },
        }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: memberId1,
          name: memberName1,
          alias: null,
          role: memberRole1,
          status: memberStatus1,
          invitedBy: member1InvitedBy,
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: memberId2,
          name: memberName2,
          alias: null,
          role: memberRole2,
          status: memberStatus2,
          invitedBy: member2InvitedBy,
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if members do not exist', async () => {
      const memberId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.findOrFail({ where: { id: memberId } }),
      ).rejects.toThrow('No members found.');
    });
  });

  describe('find', () => {
    it('should find members', async () => {
      const userStatus1 = faker.helpers.arrayElement(UserStatusKeys);
      const userStatus2 = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const memberName1 = faker.word.noun();
      const memberName2 = faker.word.noun();
      const memberStatus1 = faker.helpers.arrayElement(MemberStatusKeys);
      const member2Status = faker.helpers.arrayElement(MemberStatusKeys);
      const memberRole1 = faker.helpers.arrayElement(MemberRoleKeys);
      const memberRole2 = faker.helpers.arrayElement(MemberRoleKeys);
      const member1InvitedBy = getAddress(faker.finance.ethereumAddress());
      const member2InvitedBy = getAddress(faker.finance.ethereumAddress());
      const user1 = await dbUserRepo.insert({
        status: userStatus1,
      });
      const user2 = await dbUserRepo.insert({
        status: userStatus2,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: spaceStatus,
      });
      const member1 = await dbMembersRepository.insert({
        user: user1.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName1,
        status: memberStatus1,
        role: memberRole1,
        invitedBy: member1InvitedBy,
      });
      const memberId1 = member1.identifiers[0].id as Member['id'];
      const member2 = await dbMembersRepository.insert({
        user: user2.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName2,
        status: member2Status,
        role: memberRole2,
        invitedBy: member2InvitedBy,
      });
      const memberId2 = member2.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.find({ where: { id: In([memberId1, memberId2]) } }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: memberId1,
          name: memberName1,
          alias: null,
          role: memberRole1,
          status: memberStatus1,
          invitedBy: member1InvitedBy,
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: memberId2,
          name: memberName2,
          alias: null,
          role: memberRole2,
          status: member2Status,
          invitedBy: member2InvitedBy,
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should return an empty array if members do not exist', async () => {
      const memberId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.find({ where: { id: memberId } }),
      ).resolves.toEqual([]);
    });
  });

  describe('inviteUsers', () => {
    it('should invite users to a space and return the members', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const {
        user: owner,
        authPayload,
        authPayloadDto,
      } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users = faker.helpers.multiple(
        () => {
          return {
            address: getAddress(faker.finance.ethereumAddress()),
            role: faker.helpers.arrayElement(MemberRoleKeys),
            name: faker.person.firstName(),
          };
        },
        { count: { min: 2, max: 5 } },
      );

      const member = await membersRepository.inviteUsers({
        authPayload,
        spaceId,
        users,
      });

      expect(member).toEqual(
        users.map((user) => {
          return {
            userId: expect.any(Number),
            spaceId,
            name: user.name,
            role: user.role,
            status: 'INVITED',
            invitedBy: authPayloadDto.signer_address,
          };
        }),
      );
    });

    it('should invite users as OIDC admin with invitedBy null', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const { user: owner, authPayload } = await createOidcUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users = faker.helpers.multiple(
        () => {
          return {
            address: getAddress(faker.finance.ethereumAddress()),
            role: faker.helpers.arrayElement(MemberRoleKeys),
            name: faker.person.firstName(),
          };
        },
        { count: { min: 2, max: 5 } },
      );

      const member = await membersRepository.inviteUsers({
        authPayload,
        spaceId,
        users,
      });

      expect(member).toEqual(
        users.map((user) => {
          return {
            userId: expect.any(Number),
            spaceId,
            name: user.name,
            role: user.role,
            status: 'INVITED',
            invitedBy: null,
          };
        }),
      );
    });

    it('should not create PENDING users for existing ones', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const { user: owner, authPayload } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberWallet = getAddress(faker.finance.ethereumAddress());
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: memberWallet,
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const memberName = nameBuilder();

      await membersRepository.inviteUsers({
        authPayload,
        spaceId,
        users: [
          {
            address: memberWallet,
            role: memberRole,
            name: memberName,
          },
        ],
      });

      await expect(
        dbWalletRepo.find({
          where: {
            address: memberWallet,
          },
          relations: { user: true },
        }),
      ).resolves.toEqual([
        {
          address: memberWallet,
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
          user: {
            createdAt: expect.any(Date),
            extUserId: null,
            id: member.generatedMaps[0].id,
            status: 'ACTIVE',
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should throw an error if not authenticated', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const users: Array<{
        address: Address;
        role: keyof typeof MemberRole;
        name: string;
      }> = [];

      await expect(
        membersRepository.inviteUsers({
          authPayload: new AuthPayload(),
          spaceId,
          users,
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should not allow inviting users if the user is not an ADMIN', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const { user: owner, authPayload } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users = faker.helpers.multiple(
        () => {
          return {
            address: getAddress(faker.finance.ethereumAddress()),
            role: faker.helpers.arrayElement(MemberRoleKeys),
            name: faker.person.firstName(),
          };
        },
        { count: { min: 2, max: 5 } },
      );

      await expect(
        membersRepository.inviteUsers({
          authPayload,
          spaceId,
          users,
        }),
      ).rejects.toThrow(new ForbiddenException('User is not an active admin.'));
    });

    it('should not allow inviting users if the user is a NON-ACTIVE ADMIN', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const { user: owner, authPayload } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'INVITED',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users = faker.helpers.multiple(
        () => {
          return {
            address: getAddress(faker.finance.ethereumAddress()),
            role: faker.helpers.arrayElement(MemberRoleKeys),
            name: faker.person.firstName(),
          };
        },
        { count: { min: 2, max: 5 } },
      );

      await expect(
        membersRepository.inviteUsers({
          authPayload,
          spaceId,
          users,
        }),
      ).rejects.toThrow(new ForbiddenException('User is not an active admin.'));
    });

    it('should not allow inviting users if the signer is an admin of another space', async () => {
      const sourceSpaceName = nameBuilder();
      const targetSpaceName = nameBuilder();
      const memberName = nameBuilder();
      const { user: owner, authPayload } = await createSiweUser();
      const sourceSpace = await dbSpacesRepository.insert({
        name: sourceSpaceName,
        status: 'ACTIVE',
      });
      const targetSpace = await dbSpacesRepository.insert({
        name: targetSpaceName,
        status: 'ACTIVE',
      });
      const targetSpaceId = targetSpace.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: sourceSpace.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users = faker.helpers.multiple(
        () => {
          return {
            address: getAddress(faker.finance.ethereumAddress()),
            role: faker.helpers.arrayElement(MemberRoleKeys),
            name: faker.person.firstName(),
          };
        },
        { count: { min: 1, max: 3 } },
      );

      await expect(
        membersRepository.inviteUsers({
          authPayload,
          spaceId: targetSpaceId,
          users,
        }),
      ).rejects.toThrow(new ForbiddenException('User is not an active admin.'));
    });

    it('should throw an error if the space does not exist', async () => {
      const { authPayload } = await createSiweUser();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const users: Array<{
        address: Address;
        role: keyof typeof MemberRole;
        name: string;
      }> = [];

      await expect(
        membersRepository.inviteUsers({
          authPayload,
          spaceId,
          users,
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the signer_address member is not ACTIVE', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const { user: admin } = await createSiweUser();
      const { user: invitedAdmin, authPayload: invitedAdminAuthPayload } =
        await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: invitedAdmin,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'INVITED',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users: Array<{
        address: Address;
        role: keyof typeof MemberRole;
        name: string;
      }> = [];

      await expect(
        membersRepository.inviteUsers({
          authPayload: invitedAdminAuthPayload,
          spaceId,
          users,
        }),
      ).rejects.toThrow(new ForbiddenException('User is not an active admin.'));
    });
  });

  describe('acceptInvite', () => {
    it('should accept an invite to a space, setting the member and user to ACTIVE', async () => {
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const { userId, user, authPayload } = await createSiweUser({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
      });
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'INVITED',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await membersRepository.acceptInvite({
        authPayload,
        spaceId,
        payload: {
          name: memberName,
        },
      });

      await expect(
        dbMembersRepository.findOneOrFail({
          where: { id: memberId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: memberId,
        name: memberName,
        alias: null,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
        updatedAt: expect.any(Date),
      });
      await expect(
        dbUserRepo.findOneOrFail({
          where: { id: userId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        extUserId: null,
        id: userId,
        status: 'ACTIVE', // No longer PENDING
        updatedAt: expect.any(Date),
      });
    });

    it('should accept an invite for OIDC user', async () => {
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const { user, authPayload } = await createOidcUser({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
      });
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'INVITED',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await membersRepository.acceptInvite({
        authPayload,
        spaceId,
        payload: {
          name: memberName,
        },
      });

      await expect(
        dbMembersRepository.findOneOrFail({
          where: { id: memberId },
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          id: memberId,
          status: 'ACTIVE',
          name: memberName,
        }),
      );
    });

    it.each([
      ['SIWE', createSiweUser],
      ['OIDC', createOidcUser],
    ] as const)('should accept an invite to a space and override the name (%s)', async (_label, createUser) => {
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const { userId, user, authPayload } = await createUser({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
      });
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'INVITED',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];
      const updatedName = nameBuilder();

      await membersRepository.acceptInvite({
        authPayload,
        spaceId,
        payload: {
          name: updatedName,
        },
      });

      await expect(
        dbMembersRepository.findOneOrFail({
          where: { id: memberId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: memberId,
        name: updatedName,
        alias: null,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
        updatedAt: expect.any(Date),
      });
      await expect(
        dbUserRepo.findOneOrFail({
          where: { id: userId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        extUserId: null,
        id: userId,
        status: 'ACTIVE', // No longer PENDING
        updatedAt: expect.any(Date),
      });
    });

    it('should not accept the invite if the user was not invited', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const { user: admin } = await createSiweUser();
      const { authPayload: nonMemberAuthPayload } = await createSiweUser({
        status: 'PENDING',
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin,
        space: space.generatedMaps[0],
        name: adminName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.acceptInvite({
          authPayload: nonMemberAuthPayload,
          spaceId,
          payload: {
            name: adminName,
          },
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if not authenticated', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const memberName = nameBuilder();

      await expect(
        membersRepository.acceptInvite({
          authPayload: new AuthPayload(),
          spaceId,
          payload: {
            name: memberName,
          },
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw if the user is not found', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const memberName = nameBuilder();

      await expect(
        membersRepository.acceptInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          payload: {
            name: memberName,
          },
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the space does not exist', async () => {
      const memberName = nameBuilder();
      const { authPayload } = await createSiweUser({ status: 'PENDING' });
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.acceptInvite({
          authPayload,
          spaceId,
          payload: {
            name: memberName,
          },
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the user is already a member of the space', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const { user: admin } = await createSiweUser();
      const { user: member, authPayload: memberAuthPayload } =
        await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: member,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.acceptInvite({
          authPayload: memberAuthPayload,
          spaceId,
          payload: { name: memberName },
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the user is not INVITED to the space', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const { user, authPayload } = await createSiweUser({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.acceptInvite({
          authPayload,
          spaceId,
          payload: {
            name: memberName,
          },
        }),
      ).rejects.toThrow('Space not found.');
    });
  });

  describe('declineInvite', () => {
    it('should accept an invite to a space, setting the member to DECLINED', async () => {
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const { userId, user, authPayload } = await createSiweUser({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
      });
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'INVITED',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await membersRepository.declineInvite({
        authPayload,
        spaceId,
      });

      await expect(
        dbMembersRepository.findOneOrFail({
          where: { id: memberId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: memberId,
        name: memberName,
        alias: null,
        role: memberRole,
        status: 'DECLINED',
        invitedBy: memberInvitedBy,
        updatedAt: expect.any(Date),
      });
      await expect(
        dbUserRepo.findOneOrFail({
          where: { id: userId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        extUserId: null,
        id: userId,
        status: 'PENDING', // Remains PENDING
        updatedAt: expect.any(Date),
      });
    });

    it('should decline an invite for OIDC user', async () => {
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const { user, authPayload } = await createOidcUser({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
      });
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'INVITED',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await membersRepository.declineInvite({
        authPayload,
        spaceId,
      });

      await expect(
        dbMembersRepository.findOneOrFail({
          where: { id: memberId },
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          id: memberId,
          status: 'DECLINED',
          name: memberName,
        }),
      );
    });

    it('should not decline the invite if the user was not invited', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const { user: admin } = await createSiweUser();
      const { authPayload: nonMemberAuthPayload } = await createSiweUser({
        status: 'PENDING',
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin,
        space: space.generatedMaps[0],
        name: adminName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.declineInvite({
          authPayload: nonMemberAuthPayload,
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if not authenticated', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.declineInvite({
          authPayload: new AuthPayload(),
          spaceId,
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw if the user is not found', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.declineInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the space does not exist', async () => {
      const { authPayload } = await createSiweUser({ status: 'PENDING' });
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.declineInvite({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the user is already a member of the space', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const { user: admin } = await createSiweUser();
      const { user: member, authPayload: memberAuthPayload } =
        await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: member,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.declineInvite({
          authPayload: memberAuthPayload,
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the user is not INVITED to the space', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const { user, authPayload } = await createSiweUser({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.declineInvite({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
    });
  });

  describe('findAuthorizedMembersOrFail', () => {
    it('should find members by space id', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const userStatus = faker.helpers.arrayElement<'ACTIVE' | 'PENDING'>(
        UserStatusKeys,
      );
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const { userId, user, authPayload } = await createSiweUser({
        status: userStatus,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload,
          spaceId,
        }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: memberId,
          name: memberName,
          alias: null,
          role: memberRole,
          status: 'ACTIVE',
          invitedBy: memberInvitedBy,
          updatedAt: expect.any(Date),
          user: {
            createdAt: expect.any(Date),
            extUserId: null,
            id: userId,
            status: userStatus,
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should find members by space id for OIDC user', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const userStatus = faker.helpers.arrayElement<'ACTIVE' | 'PENDING'>(
        UserStatusKeys,
      );
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const { user, authPayload } = await createOidcUser({
        status: userStatus,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload,
          spaceId,
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          id: memberId,
          name: memberName,
          role: memberRole,
          status: 'ACTIVE',
        }),
      ]);
    });

    it('should throw an error if not authenticated', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(),
          spaceId,
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw if the user is not found', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'The user is not an active member of the space.',
        ),
      );
    });

    it('should throw an error if the user is not a member of the space', async () => {
      const userStatus = faker.helpers.arrayElement<'ACTIVE' | 'PENDING'>(
        UserStatusKeys,
      );
      const spaceName = nameBuilder();
      const { authPayload } = await createSiweUser({ status: userStatus });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'The user is not an active member of the space.',
        ),
      );
    });

    it('should throw an error if the user is not an active member of the space', async () => {
      const spaceName = nameBuilder();
      const { user, authPayload, authPayloadDto } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: faker.person.firstName(),
        role: faker.helpers.arrayElement(MemberRoleKeys),
        status: 'DECLINED',
        invitedBy: authPayloadDto.signer_address,
      });

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'The user is not an active member of the space.',
        ),
      );
    });
  });

  describe('findSelfMembershipOrFail', () => {
    it.each([
      ['SIWE', 'ACTIVE', createSiweUser],
      ['OIDC', 'ACTIVE', createOidcUser],
      ['SIWE', 'INVITED', createSiweUser],
      ['OIDC', 'INVITED', createOidcUser],
    ] as const)('should return the membership row for a %s caller with %s status', async (_authLabel, memberStatus, createUser) => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const { userId, user, authPayload } = await createUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: memberStatus,
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.findSelfMembershipOrFail({
          authPayload,
          spaceId,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          id: memberId,
          name: memberName,
          alias: null,
          role: memberRole,
          status: memberStatus,
          invitedBy: memberInvitedBy,
          user: expect.objectContaining({ id: userId }),
        }),
      );
    });

    it('should throw ForbiddenException for a DECLINED caller', async () => {
      const spaceName = nameBuilder();
      const { user, authPayload, authPayloadDto } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: faker.person.firstName(),
        role: faker.helpers.arrayElement(MemberRoleKeys),
        status: 'DECLINED',
        invitedBy: authPayloadDto.signer_address,
      });

      await expect(
        membersRepository.findSelfMembershipOrFail({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'The user is not an active member of the space.',
        ),
      );
    });

    it('should throw ForbiddenException when the caller has no membership row in the space', async () => {
      const spaceName = nameBuilder();
      const { authPayload } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;

      await expect(
        membersRepository.findSelfMembershipOrFail({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'The user is not an active member of the space.',
        ),
      );
    });
  });

  describe('updateRole', () => {
    it('should update the role of a member', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const { user: owner, authPayload } = await createSiweUser();
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = member.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
          authPayload,
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();
    });

    it('should update the role of a member as OIDC admin', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const { user: owner, authPayload } = await createOidcUser();
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = member.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
          authPayload,
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();
    });

    it.each([
      ['SIWE', createSiweUser],
      ['OIDC', createOidcUser],
    ] as const)('should update the role of a member within the space only (%s)', async (_label, createUser) => {
      const spaceName = nameBuilder();
      const space2Name = faker.word.noun();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const member2Name = nameBuilder();
      const { user: adminUser, authPayload } = await createUser();
      const { userId: memberUserId, user: memberUser } = await createUser();
      await dbWalletRepo.insert({
        user: memberUser,
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const space2 = await dbSpacesRepository.insert({
        name: space2Name,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      const space2Id = space2.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: adminUser,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      // Add the user to space1
      await dbMembersRepository.insert({
        user: memberUser,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      // Add the user to space2
      await dbMembersRepository.insert({
        user: memberUser,
        space: space2.generatedMaps[0],
        name: member2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
          authPayload,
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();
      // Member role in space1 is updated
      await expect(
        membersRepository.findOneOrFail(
          {
            space: { id: spaceId },
            user: { id: memberUserId },
          },
          { space: true },
        ),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: expect.any(Number),
        name: memberName,
        alias: null,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: expect.any(String),
        updatedAt: expect.any(Date),
        space: expect.objectContaining({ id: spaceId }),
      });
      // Member role in space2 should not be affected
      await expect(
        membersRepository.findOneOrFail(
          {
            space: { id: space2Id },
            user: { id: memberUserId },
          },
          { space: true },
        ),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: expect.any(Number),
        name: member2Name,
        alias: null,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: expect.any(String),
        updatedAt: expect.any(Date),
        space: expect.objectContaining({ id: space2Id }),
      });
    });

    it('should not allow updating MEMBERs if the signer is not an ADMIN', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
      const { userId: userToUpdateId, user: userToUpdate } =
        await createSiweUser();
      const { user: member, authPayload: memberAuthPayload } =
        await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: userToUpdate,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: member,
        space: space.generatedMaps[0],
        name: memberName2,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
          authPayload: memberAuthPayload,
          spaceId,
          role: 'ADMIN',
          userId: userToUpdateId,
        }),
      ).rejects.toThrow('No members found.');
    });

    it('should not allow updating ADMINs if the signer is not an ADMIN', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
      const { userId: userToUpdateId, user: userToUpdate } =
        await createSiweUser();
      const { user: member, authPayload: memberAuthPayload } =
        await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: userToUpdate,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: member,
        space: space.generatedMaps[0],
        name: memberName2,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
          authPayload: memberAuthPayload,
          spaceId,
          role: 'ADMIN',
          userId: userToUpdateId,
        }),
      ).rejects.toThrow('User is not an active admin.');
    });

    it('should throw an error if not authenticated', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.updateRole({
          authPayload: new AuthPayload(),
          spaceId,
          role: 'ADMIN',
          userId: userId,
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw an error if user does not have access to upgrade to ADMIN', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
      const { user: owner, authPayload } = await createSiweUser();
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = member.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName2,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
          authPayload,
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).rejects.toThrow('No members found.');
    });

    it('should throw an error if downgrading the last ACTIVE ADMIN', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const { userId, user, authPayload } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
          authPayload,
          spaceId,
          role: 'MEMBER',
          userId,
        }),
      ).rejects.toThrow('Cannot remove last admin.');
    });
  });

  describe('removeUser', () => {
    it('should remove the user', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
      const { user: owner, authPayload } = await createSiweUser();
      const memberUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = memberUser.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: memberUser.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const member = await dbMembersRepository.insert({
        user: memberUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName2,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.removeUser({
          authPayload,
          spaceId,
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbMembersRepository.findOne({ where: { id: memberId } }),
      ).resolves.toBeNull();
    });

    it('should remove the user as OIDC admin', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
      const { user: owner, authPayload } = await createOidcUser();
      const memberUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = memberUser.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: memberUser.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const member = await dbMembersRepository.insert({
        user: memberUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName2,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.removeUser({
          authPayload,
          spaceId,
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbMembersRepository.findOne({ where: { id: memberId } }),
      ).resolves.toBeNull();
    });

    it.each([
      ['SIWE', createSiweUser],
      ['OIDC', createOidcUser],
    ] as const)('should keep the user as a member of other spaces (%s)', async (_label, createUser) => {
      const spaceName = nameBuilder();
      const space2Name = faker.word.noun();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin2Name = nameBuilder();
      const member2Name = nameBuilder();
      const { user: owner, authPayload } = await createUser();
      const memberUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = memberUser.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: memberUser.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const space2 = await dbSpacesRepository.insert({
        name: space2Name,
        status: 'ACTIVE',
      });

      // Add as a member of space1
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const member = await dbMembersRepository.insert({
        user: memberUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const memberId = member.identifiers[0].id as Member['id'];

      // Add as a member of space2
      await dbMembersRepository.insert({
        user: owner,
        space: space2.generatedMaps[0],
        name: admin2Name,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const member2InvitedBy = getAddress(faker.finance.ethereumAddress());
      const member2 = await dbMembersRepository.insert({
        user: memberUser.generatedMaps[0],
        space: space2.generatedMaps[0],
        name: member2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: member2InvitedBy,
      });
      const member2memberId = member2.identifiers[0].id as Member['id'];

      // Delete from space1
      await expect(
        membersRepository.removeUser({
          authPayload,
          spaceId,
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();
      await expect(
        dbMembersRepository.findOne({ where: { id: memberId } }),
      ).resolves.toBeNull();

      // Ensure still a member of space2
      await expect(
        dbMembersRepository.findOne({ where: { id: member2memberId } }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: member2memberId,
        name: member2Name,
        alias: null,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: member2InvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should not allow removing a user if the user is not an ADMIN', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const { userId: adminUserId, user: admin } = await createSiweUser();
      const { user: member, authPayload: memberAuthPayload } =
        await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbMembersRepository.insert({
        user: member,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeUser({
          authPayload: memberAuthPayload,
          spaceId,
          userId: adminUserId,
        }),
      ).rejects.toThrow('User is not an active admin.');
    });

    it('should throw an error if not authenticated', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.removeUser({
          authPayload: new AuthPayload(),
          spaceId,
          userId,
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it.each([
      ['SIWE', createSiweUser],
      ['OIDC', createOidcUser],
    ] as const)('should throw an error if removing the last ACTIVE ADMIN (%s)', async (_label, createUser) => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const { userId, user, authPayload } = await createUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user,
        name: memberName,
        space: space.generatedMaps[0],
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeUser({
          authPayload,
          spaceId,
          userId,
        }),
      ).rejects.toThrow('Cannot remove last admin.');
    });

    it('should throw an error if there are no members for the given space id', async () => {
      const { userId, authPayload } = await createSiweUser();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        membersRepository.removeUser({
          authPayload,
          spaceId,
          userId,
        }),
      ).rejects.toThrow('No members found.');
    });

    it('should throw an error if the user is not a member of the space', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const { user: admin, authPayload } = await createSiweUser();
      const nonMember = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const nonMemberUserId = nonMember.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: nonMember.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeUser({
          authPayload,
          spaceId,
          userId: nonMemberUserId,
        }),
      ).rejects.toThrow('Member not found.');
    });
  });

  describe('removeSelf', () => {
    it('should remove the signer', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const { user: signerUser, authPayload } = await createSiweUser();
      const otherAdmin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: otherAdmin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: otherAdmin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMember = await dbMembersRepository.insert({
        user: signerUser,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMemberId = signerMember.identifiers[0].id;

      await expect(
        membersRepository.removeSelf({
          authPayload,
          spaceId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbMembersRepository.findOne({ where: { id: signerMemberId } }),
      ).resolves.toBeNull();
    });

    it('should remove self as OIDC user', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const { user: signerUser, authPayload } = await createOidcUser();
      const otherAdmin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: otherAdmin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: otherAdmin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMember = await dbMembersRepository.insert({
        user: signerUser,
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMemberId = signerMember.identifiers[0].id;

      await expect(
        membersRepository.removeSelf({
          authPayload,
          spaceId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbMembersRepository.findOne({ where: { id: signerMemberId } }),
      ).resolves.toBeNull();
    });

    it.each([
      ['SIWE', createSiweUser],
      ['OIDC', createOidcUser],
    ] as const)('should remove the signer even if they are not an ACTIVE ADMIN (%s)', async (_label, createUser) => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const adminName = nameBuilder();
      const { user: signerUser, authPayload } = await createUser();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMember = await dbMembersRepository.insert({
        user: signerUser,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMemberId = signerMember.identifiers[0].id;

      await expect(
        membersRepository.removeSelf({
          authPayload,
          spaceId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbMembersRepository.findOne({ where: { id: signerMemberId } }),
      ).resolves.toBeNull();
    });

    it.each([
      ['SIWE', createSiweUser],
      ['OIDC', createOidcUser],
    ] as const)('should keep the signer as a member of other spaces (%s)', async (_label, createUser) => {
      const space1Name = nameBuilder();
      const space2Name = faker.word.noun();
      const member1Name = nameBuilder();
      const member2Name = nameBuilder();
      const adminName = nameBuilder();
      const { user: signerUser, authPayload } = await createUser();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space1 = await dbSpacesRepository.insert({
        name: space1Name,
        status: 'ACTIVE',
      });
      const space2 = await dbSpacesRepository.insert({
        name: space2Name,
        status: 'ACTIVE',
      });
      const spaceId1 = space1.generatedMaps[0].id;

      // Add to first space
      await dbMembersRepository.insert({
        user: admin.generatedMaps[0],
        space: space1.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMember1 = await dbMembersRepository.insert({
        user: signerUser,
        space: space1.generatedMaps[0],
        name: member1Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMemberId1 = signerMember1.identifiers[0].id;

      // Add to second space
      const signerMember2InvitedBy = getAddress(
        faker.finance.ethereumAddress(),
      );
      const signerMember2 = await dbMembersRepository.insert({
        user: signerUser,
        space: space2.generatedMaps[0],
        name: member2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: signerMember2InvitedBy,
      });
      const signerMemberId2 = signerMember2.identifiers[0].id;

      await expect(
        membersRepository.removeSelf({
          authPayload,
          spaceId: spaceId1,
        }),
      ).resolves.not.toThrow();

      // Should be removed from first space
      await expect(
        dbMembersRepository.findOne({ where: { id: signerMemberId1 } }),
      ).resolves.toBeNull();

      // Should still be in second space
      await expect(
        dbMembersRepository.findOne({ where: { id: signerMemberId2 } }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: signerMemberId2,
        name: member2Name,
        alias: null,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: signerMember2InvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the signer is the last ACTIVE ADMIN', async () => {
      const spaceName = nameBuilder();
      const signerMemberName = nameBuilder();
      const { user: signerUser, authPayload } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: signerUser,
        space: space.generatedMaps[0],
        name: signerMemberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeSelf({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow('Cannot remove last admin.');
    });

    it('should throw an error if the signer is not a member of the space', async () => {
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const { authPayload } = await createSiweUser();
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeSelf({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow('Member not found.');
    });
  });

  describe('updateAlias', () => {
    it('should add an alias for the authenticated user', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const newAlias = nameBuilder();

      const { user, authPayload } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateAlias({
          authPayload,
          spaceId,
          alias: newAlias,
        }),
      ).resolves.toBeUndefined();

      const updatedMember = await dbMembersRepository.findOneOrFail({
        where: { id: member.identifiers[0].id },
      });
      expect(updatedMember.alias).toBe(newAlias);
    });

    it('should add an alias for OIDC user', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const newAlias = nameBuilder();

      const { user, authPayload } = await createOidcUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateAlias({
          authPayload,
          spaceId,
          alias: newAlias,
        }),
      ).resolves.toBeUndefined();

      const updatedMember = await dbMembersRepository.findOneOrFail({
        where: { id: member.identifiers[0].id },
      });
      expect(updatedMember.alias).toBe(newAlias);
    });

    it.each([
      ['SIWE', createSiweUser],
      ['OIDC', createOidcUser],
    ] as const)('should update alias from one value to another (%s)', async (_label, createUser) => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const newAlias = nameBuilder();

      const { user, authPayload } = await createUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        alias: nameBuilder(),
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateAlias({
          authPayload,
          spaceId,
          alias: newAlias,
        }),
      ).resolves.toBeUndefined();

      const updatedMember = await dbMembersRepository.findOneOrFail({
        where: { id: member.identifiers[0].id },
      });
      expect(updatedMember.alias).toBe(newAlias);
    });

    it.each([
      ['SIWE', createSiweUser],
      ['OIDC', createOidcUser],
    ] as const)('should update alias to null (%s)', async (_label, createUser) => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { user, authPayload } = await createUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      const member = await dbMembersRepository.insert({
        user,
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        alias: nameBuilder(),
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateAlias({
          authPayload,
          spaceId,
          alias: null,
        }),
      ).resolves.toBeUndefined();

      const updatedMember = await dbMembersRepository.findOneOrFail({
        where: { id: member.identifiers[0].id },
      });
      expect(updatedMember.alias).toBeNull();
    });

    it('should throw NotFoundException if signer is not a member of the space', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const newAlias = nameBuilder();

      const { authPayload } = await createSiweUser();
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;

      const otherUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbMembersRepository.insert({
        user: otherUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        alias: null,
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateAlias({
          authPayload,
          spaceId,
          alias: newAlias,
        }),
      ).rejects.toThrow('Member not found.');
    });

    it('should throw UnauthorizedException if signer address is not provided', async () => {
      const spaceName = nameBuilder();
      const newAlias = nameBuilder();

      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;

      await expect(
        membersRepository.updateAlias({
          authPayload: new AuthPayload(),
          spaceId,
          alias: newAlias,
        }),
      ).rejects.toThrow('Not authenticated');
    });
  });

  async function createSiweUser(
    opts: { status?: 'ACTIVE' | 'PENDING' } = {},
  ): Promise<{
    userId: number;
    user: Record<string, unknown>;
    authPayload: AuthPayload;
    authPayloadDto: ReturnType<
      ReturnType<typeof siweAuthPayloadDtoBuilder>['build']
    >;
  }> {
    const user = await dbUserRepo.insert({
      status: opts.status ?? 'ACTIVE',
    });
    const userId = user.generatedMaps[0].id as number;
    const authPayloadDto = siweAuthPayloadDtoBuilder()
      .with('sub', userId.toString())
      .build();
    await dbWalletRepo.insert({
      user: user.generatedMaps[0],
      address: authPayloadDto.signer_address,
    });
    return {
      userId,
      user: user.generatedMaps[0],
      authPayload: new AuthPayload(authPayloadDto),
      authPayloadDto,
    };
  }

  async function createOidcUser(
    opts: { status?: 'ACTIVE' | 'PENDING' } = {},
  ): Promise<{
    userId: number;
    user: Record<string, unknown>;
    authPayload: AuthPayload;
  }> {
    const user = await dbUserRepo.insert({
      status: opts.status ?? 'ACTIVE',
    });
    const userId = user.generatedMaps[0].id as number;
    const authPayloadDto = oidcAuthPayloadDtoBuilder()
      .with('sub', userId.toString())
      .build();
    return {
      userId,
      user: user.generatedMaps[0],
      authPayload: new AuthPayload(authPayloadDto),
    };
  }
});
