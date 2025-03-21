import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { SpaceStatus } from '@/domain/spaces/entities/space.entity';
import { SpacesRepository } from '@/domain/spaces/spaces.repository';
import {
  MemberRole,
  MemberStatus,
} from '@/domain/users/entities/member.entity';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { MembersRepository } from '@/domain/users/members.repository';
import { UsersRepository } from '@/domain/users/users.repository';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const UserStatusKeys = getStringEnumKeys(UserStatus);
const SpaceStatusKeys = getStringEnumKeys(SpaceStatus);
const UserOrgRoleKeys = getStringEnumKeys(MemberRole);
const MemberStatusKeys = getStringEnumKeys(MemberStatus);

describe('UserOrganizationsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let userOrgRepo: MembersRepository;

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
  const dbUserOrgRepo = dataSource.getRepository(Member);
  const dbOrgRepo = dataSource.getRepository(Space);

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

    const walletsRepo = new WalletsRepository(postgresDatabaseService);
    userOrgRepo = new MembersRepository(
      postgresDatabaseService,
      new UsersRepository(postgresDatabaseService, walletsRepo),
      new SpacesRepository(postgresDatabaseService),
      walletsRepo,
    );
  });

  afterEach(async () => {
    jest.resetAllMocks();

    await Promise.all(
      [Member, Space, User, Wallet].map(async (entity) => {
        const repository = dataSource.getRepository(entity);
        return await repository
          .createQueryBuilder()
          .delete()
          .where('1=1')
          .execute();
      }),
    );
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  // As the triggers are set on the database level, Jest's fake timers are not accurate
  describe('createdAt/updatedAt', () => {
    it('should set createdAt and updatedAt when creating a User Organization', async () => {
      const before = new Date().getTime();

      const dbUserRepo = dataSource.getRepository(User);
      const dbOrgRepo = dataSource.getRepository(Space);
      const dbUserOrgRepo = dataSource.getRepository(Member);
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const space = await dbOrgRepo.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });
      const member = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: faker.person.firstName(),
        status: faker.helpers.arrayElement(MemberStatusKeys),
        role: faker.helpers.arrayElement(UserOrgRoleKeys),
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      const after = new Date().getTime();

      const createdAt = member.generatedMaps[0].createdAt;
      const updatedAt = member.generatedMaps[0].updatedAt;

      if (!(createdAt instanceof Date) || !(updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt).toEqual(updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(createdAt.getTime()).toBeLessThanOrEqual(after);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a User Organization', async () => {
      const dbUserRepo = dataSource.getRepository(User);
      const dbOrgRepo = dataSource.getRepository(Space);
      const dbUserOrgRepo = dataSource.getRepository(Member);
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const space = await dbOrgRepo.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });
      const prevUserOrg = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: faker.person.firstName(),
        status: 'ACTIVE',
        role: faker.helpers.arrayElement(UserOrgRoleKeys),
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      const userOrgId = prevUserOrg.identifiers[0].id as User['id'];
      await dbUserOrgRepo.update(userOrgId, {
        status: 'DECLINED',
      });
      const updatedUserOrg = await dbUserOrgRepo.findOneOrFail({
        where: { id: userOrgId },
      });

      const prevUpdatedAt = prevUserOrg.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(
        updatedUserOrg.updatedAt.getTime(),
      );
    });
  });

  describe('findOneOrFail', () => {
    it('should find a member', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = faker.word.noun();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const userOrgName = faker.word.noun();
      const userOrgStatus = faker.helpers.arrayElement(MemberStatusKeys);
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const userOrgInvitedBy = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: spaceStatus,
      });
      const member = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        status: userOrgStatus,
        role: userOrgRole,
        invitedBy: userOrgInvitedBy,
      });
      const userOrgId = member.identifiers[0].id as Member['id'];

      await expect(
        userOrgRepo.findOneOrFail({ id: userOrgId }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userOrgId,
        name: userOrgName,
        role: userOrgRole,
        status: userOrgStatus,
        invitedBy: userOrgInvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the member does not exist', async () => {
      const userOrgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.findOneOrFail({ id: userOrgId }),
      ).rejects.toThrow('Member not found.');
    });
  });

  describe('findOne', () => {
    it('should find a member', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = faker.word.noun();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const userOrgName = faker.word.noun();
      const userOrgStatus = faker.helpers.arrayElement(MemberStatusKeys);
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const userOrgInvitedBy = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: spaceStatus,
      });
      const member = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        status: userOrgStatus,
        role: userOrgRole,
        invitedBy: userOrgInvitedBy,
      });
      const userOrgId = member.identifiers[0].id as Member['id'];

      await expect(userOrgRepo.findOne({ id: userOrgId })).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userOrgId,
        name: userOrgName,
        role: userOrgRole,
        status: userOrgStatus,
        invitedBy: userOrgInvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should return null if the member does not exist', async () => {
      const userOrgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(userOrgRepo.findOne({ id: userOrgId })).resolves.toBeNull();
    });
  });

  describe('findOrFail', () => {
    it('should find members', async () => {
      const userStatus1 = faker.helpers.arrayElement(UserStatusKeys);
      const userStatus2 = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = faker.word.noun();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const userOrgName1 = faker.word.noun();
      const userOrgName2 = faker.word.noun();
      const userOrgStatus1 = faker.helpers.arrayElement(MemberStatusKeys);
      const userOrgStatus2 = faker.helpers.arrayElement(MemberStatusKeys);
      const userOrgRole1 = faker.helpers.arrayElement(UserOrgRoleKeys);
      const userOrgRole2 = faker.helpers.arrayElement(UserOrgRoleKeys);
      const userOrgInvitedBy1 = getAddress(faker.finance.ethereumAddress());
      const userOrgInvitedBy2 = getAddress(faker.finance.ethereumAddress());
      const user1 = await dbUserRepo.insert({
        status: userStatus1,
      });
      const user2 = await dbUserRepo.insert({
        status: userStatus2,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: spaceStatus,
      });
      const userOrg1 = await dbUserOrgRepo.insert({
        user: user1.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName1,
        status: userOrgStatus1,
        role: userOrgRole1,
        invitedBy: userOrgInvitedBy1,
      });
      const userOrgId1 = userOrg1.identifiers[0].id as Member['id'];
      const userOrg2 = await dbUserOrgRepo.insert({
        user: user2.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName2,
        status: userOrgStatus2,
        role: userOrgRole2,
        invitedBy: userOrgInvitedBy2,
      });
      const userOrgId2 = userOrg2.identifiers[0].id as Member['id'];

      await expect(
        userOrgRepo.findOrFail({ where: { id: In([userOrgId1, userOrgId2]) } }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: userOrgId1,
          name: userOrgName1,
          role: userOrgRole1,
          status: userOrgStatus1,
          invitedBy: userOrgInvitedBy1,
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: userOrgId2,
          name: userOrgName2,
          role: userOrgRole2,
          status: userOrgStatus2,
          invitedBy: userOrgInvitedBy2,
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if members do not exist', async () => {
      const userOrgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.findOrFail({ where: { id: userOrgId } }),
      ).rejects.toThrow('No members found.');
    });
  });

  describe('find', () => {
    it('should find members', async () => {
      const userStatus1 = faker.helpers.arrayElement(UserStatusKeys);
      const userStatus2 = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = faker.word.noun();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const userOrgName1 = faker.word.noun();
      const userOrgName2 = faker.word.noun();
      const userOrgStatus1 = faker.helpers.arrayElement(MemberStatusKeys);
      const userOrgStatus2 = faker.helpers.arrayElement(MemberStatusKeys);
      const userOrgRole1 = faker.helpers.arrayElement(UserOrgRoleKeys);
      const userOrgRole2 = faker.helpers.arrayElement(UserOrgRoleKeys);
      const userOrgInvitedBy1 = getAddress(faker.finance.ethereumAddress());
      const userOrgInvitedBy2 = getAddress(faker.finance.ethereumAddress());
      const user1 = await dbUserRepo.insert({
        status: userStatus1,
      });
      const user2 = await dbUserRepo.insert({
        status: userStatus2,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: spaceStatus,
      });
      const userOrg1 = await dbUserOrgRepo.insert({
        user: user1.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName1,
        status: userOrgStatus1,
        role: userOrgRole1,
        invitedBy: userOrgInvitedBy1,
      });
      const userOrgId1 = userOrg1.identifiers[0].id as Member['id'];
      const userOrg2 = await dbUserOrgRepo.insert({
        user: user2.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName2,
        status: userOrgStatus2,
        role: userOrgRole2,
        invitedBy: userOrgInvitedBy2,
      });
      const userOrgId2 = userOrg2.identifiers[0].id as Member['id'];

      await expect(
        userOrgRepo.find({ where: { id: In([userOrgId1, userOrgId2]) } }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: userOrgId1,
          name: userOrgName1,
          role: userOrgRole1,
          status: userOrgStatus1,
          invitedBy: userOrgInvitedBy1,
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: userOrgId2,
          name: userOrgName2,
          role: userOrgRole2,
          status: userOrgStatus2,
          invitedBy: userOrgInvitedBy2,
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should return an empty array if members do not exist', async () => {
      const userOrgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.find({ where: { id: userOrgId } }),
      ).resolves.toEqual([]);
    });
  });

  describe('inviteUsers', () => {
    it('should invite users to a space and return the members', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminOrgName = faker.person.firstName();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminOrgName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users = faker.helpers.multiple(
        () => {
          return {
            address: getAddress(faker.finance.ethereumAddress()),
            role: faker.helpers.arrayElement(UserOrgRoleKeys),
            name: faker.person.firstName(),
          };
        },
        { count: { min: 2, max: 5 } },
      );

      const member = await userOrgRepo.inviteUsers({
        authPayload: new AuthPayload(authPayloadDto),
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

    it('should not create PENDING users for existing ones', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminOrgName = faker.person.firstName();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminOrgName,
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
      const memberRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const memberName = faker.person.firstName();

      await userOrgRepo.inviteUsers({
        authPayload: new AuthPayload(authPayloadDto),
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
            id: member.generatedMaps[0].id,
            status: 'ACTIVE',
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should throw an error if the signer_address does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const users: Array<{
        address: `0x${string}`;
        role: keyof typeof MemberRole;
        name: string;
      }> = [];

      await expect(
        userOrgRepo.inviteUsers({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow('Signer address not provided.');
    });

    it('should throw if the signer_address has no user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const users: Array<{
        address: `0x${string}`;
        role: keyof typeof MemberRole;
        name: string;
      }> = [];

      await expect(
        userOrgRepo.inviteUsers({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should not allow inviting users if the user is not an ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users = faker.helpers.multiple(
        () => {
          return {
            address: getAddress(faker.finance.ethereumAddress()),
            role: faker.helpers.arrayElement(UserOrgRoleKeys),
            name: faker.person.firstName(),
          };
        },
        { count: { min: 2, max: 5 } },
      );

      await expect(
        userOrgRepo.inviteUsers({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow(
        new UnauthorizedException('Signer is not an active admin.'),
      );
    });

    it('should not allow inviting users if the user is a NON-ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'ADMIN',
        status: 'INVITED',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users = faker.helpers.multiple(
        () => {
          return {
            address: getAddress(faker.finance.ethereumAddress()),
            role: faker.helpers.arrayElement(UserOrgRoleKeys),
            name: faker.person.firstName(),
          };
        },
        { count: { min: 2, max: 5 } },
      );

      await expect(
        userOrgRepo.inviteUsers({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow(
        new UnauthorizedException('Signer is not an active admin.'),
      );
    });

    it('should throw an error if the organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const users: Array<{
        address: `0x${string}`;
        role: keyof typeof MemberRole;
        name: string;
      }> = [];

      await expect(
        userOrgRepo.inviteUsers({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow('Organization not found.');
    });

    it('should throw an error if the signer_address user space is not ACTIVE', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const pendingAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const invitedAdmin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      await dbWalletRepo.insert({
        user: invitedAdmin.generatedMaps[0],
        address: pendingAuthPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: invitedAdmin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'INVITED',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const users: Array<{
        address: `0x${string}`;
        role: keyof typeof MemberRole;
        name: string;
      }> = [];

      await expect(
        userOrgRepo.inviteUsers({
          authPayload: new AuthPayload(pendingAuthPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow(
        new UnauthorizedException('Signer is not an active admin.'),
      );
    });
  });

  describe('acceptInvite', () => {
    it('should accept an invite to an organization, setting the member and user to ACTIVE', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const userOrgInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const userId = user.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: userOrgInvitedBy,
      });
      const member = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: userOrgRole,
        status: 'INVITED',
        invitedBy: userOrgInvitedBy,
      });
      const userOrgId = member.identifiers[0].id as Member['id'];

      await userOrgRepo.acceptInvite({
        authPayload: new AuthPayload(authPayloadDto),
        spaceId,
        payload: {
          name: userOrgName,
        },
      });

      await expect(
        dbUserOrgRepo.findOneOrFail({
          where: { id: userOrgId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userOrgId,
        name: userOrgName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: userOrgInvitedBy,
        updatedAt: expect.any(Date),
      });
      await expect(
        dbUserRepo.findOneOrFail({
          where: { id: user.generatedMaps[0].id },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userId,
        status: 'ACTIVE', // No longer PENDING
        updatedAt: expect.any(Date),
      });
    });

    it('should accept an invite to an organization and override the name', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const userOrgInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const userId = user.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: userOrgInvitedBy,
      });
      const member = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: userOrgRole,
        status: 'INVITED',
        invitedBy: userOrgInvitedBy,
      });
      const userOrgId = member.identifiers[0].id as Member['id'];
      const updatedName = faker.person.firstName();

      await userOrgRepo.acceptInvite({
        authPayload: new AuthPayload(authPayloadDto),
        spaceId,
        payload: {
          name: updatedName,
        },
      });

      await expect(
        dbUserOrgRepo.findOneOrFail({
          where: { id: userOrgId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userOrgId,
        name: updatedName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: userOrgInvitedBy,
        updatedAt: expect.any(Date),
      });
      await expect(
        dbUserRepo.findOneOrFail({
          where: { id: user.generatedMaps[0].id },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userId,
        status: 'ACTIVE', // No longer PENDING
        updatedAt: expect.any(Date),
      });
    });

    it('should not accept the invite if the user was not invited', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const nonMember = await dbUserRepo.insert({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: nonMember.generatedMaps[0],
        address: memberAuthPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.acceptInvite({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
          payload: {
            name: adminName,
          },
        }),
      ).rejects.toThrow('Organization not found.');
    });

    it('should throw an error if the signer_address does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userOrgName = faker.person.firstName();

      await expect(
        userOrgRepo.acceptInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          payload: {
            name: userOrgName,
          },
        }),
      ).rejects.toThrow('Signer address not provided.');
    });

    it('should throw if the signer_address has no user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userOrgName = faker.person.firstName();

      await expect(
        userOrgRepo.acceptInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          payload: {
            name: userOrgName,
          },
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if the organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const userOrgName = faker.person.firstName();
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.acceptInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          payload: {
            name: userOrgName,
          },
        }),
      ).rejects.toThrow('Organization not found.');
    });

    it('should throw an error if the user is already a member of the organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: memberAuthPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.acceptInvite({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
          payload: { name: userOrgName },
        }),
      ).rejects.toThrow('Organization not found.');
    });

    it('should throw an error if the user is not INVITED to the organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.acceptInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          payload: {
            name: userOrgName,
          },
        }),
      ).rejects.toThrow('Organization not found.');
    });
  });

  describe('declineInvite', () => {
    it('should accept an invite to an organization, setting the member to DECLINED', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const userOrgInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const userId = user.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: userOrgInvitedBy,
      });
      const member = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: userOrgRole,
        status: 'INVITED',
        invitedBy: userOrgInvitedBy,
      });
      const userOrgId = member.identifiers[0].id as Member['id'];

      await userOrgRepo.declineInvite({
        authPayload: new AuthPayload(authPayloadDto),
        spaceId,
      });

      await expect(
        dbUserOrgRepo.findOneOrFail({
          where: { id: userOrgId },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userOrgId,
        name: userOrgName,
        role: userOrgRole,
        status: 'DECLINED',
        invitedBy: userOrgInvitedBy,
        updatedAt: expect.any(Date),
      });
      await expect(
        dbUserRepo.findOneOrFail({
          where: { id: user.generatedMaps[0].id },
        }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userId,
        status: 'PENDING', // Remains PENDING
        updatedAt: expect.any(Date),
      });
    });

    it('should not decline the invite if the user was not invited', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const nonMember = await dbUserRepo.insert({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: nonMember.generatedMaps[0],
        address: memberAuthPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.declineInvite({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Organization not found.');
    });

    it('should throw an error if the signer_address does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.declineInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Signer address not provided.');
    });

    it('should throw if the signer_address has no user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.declineInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if the organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.declineInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Organization not found.');
    });

    it('should throw an error if the user is already a member of the organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: memberAuthPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.declineInvite({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Organization not found.');
    });

    it('should throw an error if the user is not INVITED to the organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.declineInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Organization not found.');
    });
  });

  describe('findAuthorizedUserOrgsOrFail', () => {
    it('should find members by organization id', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const userOrgInvitedBy = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      const member = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: userOrgRole,
        status: 'ACTIVE',
        invitedBy: userOrgInvitedBy,
      });
      const userOrgId = member.identifiers[0].id as Member['id'];

      await expect(
        userOrgRepo.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: userOrgId,
          name: userOrgName,
          role: userOrgRole,
          status: 'ACTIVE',
          invitedBy: userOrgInvitedBy,
          updatedAt: expect.any(Date),
          user: {
            createdAt: expect.any(Date),
            id: user.generatedMaps[0].id,
            status: userStatus,
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should throw an error if the signer_address does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Signer address not provided.');
    });

    it('should throw if the signer_address has no user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if the user is not a member of the organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = faker.word.noun();
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;

      await expect(
        userOrgRepo.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow(
        new UnauthorizedException(
          'The user is not an active member of the organization.',
        ),
      );
    });

    it('should throw an error if the user is not an active member of the organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: faker.person.firstName(),
        role: faker.helpers.arrayElement(UserOrgRoleKeys),
        status: faker.helpers.arrayElement(['INVITED', 'DECLINED']),
        invitedBy: authPayloadDto.signer_address,
      });

      await expect(
        userOrgRepo.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow(
        new UnauthorizedException(
          'The user is not an active member of the organization.',
        ),
      );
    });
  });

  describe('updateRole', () => {
    it('should update the role of a member', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = member.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.updateRole({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();
    });

    it('should update the role of a member within the organization only', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayloadDto2 = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const space2Name = faker.word.noun();
      const adminName = faker.person.firstName();
      const userOrgName = faker.person.firstName();
      const userOrg2Name = faker.person.firstName();
      const adminUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: adminUser.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      await dbWalletRepo.insert({
        user: memberUser.generatedMaps[0],
        address: authPayloadDto2.signer_address,
      });
      const memberUserId = memberUser.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: memberUser.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const space2 = await dbOrgRepo.insert({
        name: space2Name,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      const space2Id = space2.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: adminUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      // Add the user to space1
      await dbUserOrgRepo.insert({
        user: memberUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      // Add the user to space2
      await dbUserOrgRepo.insert({
        user: memberUser.generatedMaps[0],
        space: space2.generatedMaps[0],
        name: userOrg2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.updateRole({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();
      // Member role in space1 is updated
      await expect(
        userOrgRepo.findOneOrFail(
          {
            space: { id: spaceId },
            user: { id: memberUserId },
          },
          { space: true },
        ),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: expect.any(Number),
        name: userOrgName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: expect.any(String),
        updatedAt: expect.any(Date),
        space: expect.objectContaining({ id: spaceId }),
      });
      // Member role in space2 should not be affected
      await expect(
        userOrgRepo.findOneOrFail(
          {
            space: { id: space2Id },
            user: { id: memberUserId },
          },
          { space: true },
        ),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: expect.any(Number),
        name: userOrg2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: expect.any(String),
        updatedAt: expect.any(Date),
        space: expect.objectContaining({ id: space2Id }),
      });
    });

    it('should not allow updating MEMBERs if the signer is not an ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const memberName = faker.person.firstName();
      const userToUpdate = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userToUpdateId = userToUpdate.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: userToUpdate.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: memberAuthPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: userToUpdate.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.updateRole({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId: userToUpdateId,
        }),
      ).rejects.toThrow('No members found.');
    });

    it('should not allow updating ADMINs if the signer is not an ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const memberName = faker.person.firstName();
      const userToUpdate = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userToUpdateId = userToUpdate.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: userToUpdate.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: memberAuthPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: userToUpdate.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.updateRole({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId: userToUpdateId,
        }),
      ).rejects.toThrow('Signer is not an active admin.');
    });

    it('should throw an error if the signer_address does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.updateRole({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId: userId,
        }),
      ).rejects.toThrow('Signer address not provided.');
    });

    it('should throw if the signer_address has no user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.updateRole({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if user does not have access to upgrade to ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const memberName = faker.person.firstName();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = member.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.updateRole({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).rejects.toThrow('No members found.');
    });

    it('should throw an error if downgrading the last ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.updateRole({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'MEMBER',
          userId,
        }),
      ).rejects.toThrow('Cannot remove last admin.');
    });
  });

  describe('removeUser', () => {
    it('should remove the user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const memberName = faker.person.firstName();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = member.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const memberUserOrg = await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const memberUserOrgId = memberUserOrg.identifiers[0].id as Member['id'];

      await expect(
        userOrgRepo.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbUserOrgRepo.findOne({ where: { id: memberUserOrgId } }),
      ).resolves.toBeNull();
    });

    it('should keep the user as a member of other organizations', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const space2Name = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const memberName = faker.person.firstName();
      const userOrg2Name = faker.person.firstName();
      const member2Name = faker.person.firstName();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const memberUserId = member.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const space2 = await dbOrgRepo.insert({
        name: space2Name,
        status: 'ACTIVE',
      });

      // Add as a member of space1
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const memberUserOrg = await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const memberUserOrgId = memberUserOrg.identifiers[0].id as Member['id'];

      // Add as a member of space2
      await dbUserOrgRepo.insert({
        user: owner.generatedMaps[0],
        space: space2.generatedMaps[0],
        name: userOrg2Name,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const member2UserOrgInvitedBy = getAddress(
        faker.finance.ethereumAddress(),
      );
      const member2UserOrg = await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space2.generatedMaps[0],
        name: member2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: member2UserOrgInvitedBy,
      });
      const member2UserOrgId = member2UserOrg.identifiers[0].id as Member['id'];

      // Delete from space1
      await expect(
        userOrgRepo.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();
      await expect(
        dbUserOrgRepo.findOne({ where: { id: memberUserOrgId } }),
      ).resolves.toBeNull();

      // Ensure still a member of space2
      await expect(
        dbUserOrgRepo.findOne({ where: { id: member2UserOrgId } }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: member2UserOrgId,
        name: member2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: member2UserOrgInvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should not allow removing a user if the user is not an ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const memberName = faker.person.firstName();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const adminUserId = admin.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const member = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: member.generatedMaps[0],
        address: memberAuthPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: userOrgName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      await dbUserOrgRepo.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.removeUser({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
          userId: adminUserId,
        }),
      ).rejects.toThrow('Signer is not an active admin.');
    });

    it('should throw an error if the signer_address does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId,
        }),
      ).rejects.toThrow('Signer address not provided.');
    });

    it('should throw if the signer_address has no user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if removing the last ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = faker.word.noun();
      const userOrgName = faker.person.firstName();
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbOrgRepo.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        name: userOrgName,
        space: space.generatedMaps[0],
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        userOrgRepo.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId,
        }),
      ).rejects.toThrow('Cannot remove last admin.');
    });
  });
});
