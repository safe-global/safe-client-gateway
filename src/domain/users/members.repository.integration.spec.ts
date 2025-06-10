import type { IConfigurationService } from '@/config/configuration.service.interface';
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
import { nameBuilder } from '@/domain/common/entities/name.builder';
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
    it('should set createdAt and updatedAt when creating a member', async () => {
      const before = new Date().getTime();

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
          role: memberRole1,
          status: memberStatus1,
          invitedBy: member1InvitedBy,
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: memberId2,
          name: memberName2,
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
          role: memberRole1,
          status: memberStatus1,
          invitedBy: member1InvitedBy,
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: memberId2,
          name: memberName2,
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
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner.generatedMaps[0],
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
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner.generatedMaps[0],
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
        membersRepository.inviteUsers({
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
        membersRepository.inviteUsers({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should not allow inviting users if the user is not an ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner.generatedMaps[0],
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
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner.generatedMaps[0],
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
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow(
        new UnauthorizedException('Signer is not an active admin.'),
      );
    });

    it('should throw an error if the space does not exist', async () => {
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
        membersRepository.inviteUsers({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          users,
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the signer_address member is not ACTIVE', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const pendingAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
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
      await dbMembersRepository.insert({
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
        membersRepository.inviteUsers({
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
    it('should accept an invite to a space, setting the member and user to ACTIVE', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'INVITED',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await membersRepository.acceptInvite({
        authPayload: new AuthPayload(authPayloadDto),
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
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
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

    it('should accept an invite to a space and override the name', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'INVITED',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];
      const updatedName = nameBuilder();

      await membersRepository.acceptInvite({
        authPayload: new AuthPayload(authPayloadDto),
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
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
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
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
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
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.acceptInvite({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
          payload: {
            name: adminName,
          },
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the signer_address does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
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
      ).rejects.toThrow('Signer address not provided.');
    });

    it('should throw if the signer_address has no user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
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
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if the space does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberName = nameBuilder();
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
        membersRepository.acceptInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          payload: {
            name: memberName,
          },
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the user is already a member of the space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.acceptInvite({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
          payload: { name: memberName },
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the user is not INVITED to the space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

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
  });

  describe('declineInvite', () => {
    it('should accept an invite to a space, setting the member to DECLINED', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'INVITED',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await membersRepository.declineInvite({
        authPayload: new AuthPayload(authPayloadDto),
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
        role: memberRole,
        status: 'DECLINED',
        invitedBy: memberInvitedBy,
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
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
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
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.declineInvite({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
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
        membersRepository.declineInvite({
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
        membersRepository.declineInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if the space does not exist', async () => {
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
        membersRepository.declineInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the user is already a member of the space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.declineInvite({
          authPayload: new AuthPayload(memberAuthPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
    });

    it('should throw an error if the user is not INVITED to the space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.declineInvite({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Space not found.');
    });
  });

  describe('findAuthorizedMembersOrFail', () => {
    it('should find members by space id', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const memberInvitedBy = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const memberRole = faker.helpers.arrayElement(MemberRoleKeys);
      const spaceId = space.generatedMaps[0].id;
      const member = await dbMembersRepository.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: memberRole,
        status: 'ACTIVE',
        invitedBy: memberInvitedBy,
      });
      const memberId = member.identifiers[0].id as Member['id'];

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: memberId,
          name: memberName,
          role: memberRole,
          status: 'ACTIVE',
          invitedBy: memberInvitedBy,
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
        membersRepository.findAuthorizedMembersOrFail({
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
        membersRepository.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if the user is not a member of the space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow(
        new UnauthorizedException(
          'The user is not an active member of the space.',
        ),
      );
    });

    it('should throw an error if the user is not an active member of the space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: faker.person.firstName(),
        role: faker.helpers.arrayElement(MemberRoleKeys),
        status: 'DECLINED',
        invitedBy: authPayloadDto.signer_address,
      });

      await expect(
        membersRepository.findAuthorizedMembersOrFail({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow(
        new UnauthorizedException(
          'The user is not an active member of the space.',
        ),
      );
    });
  });

  describe('updateRole', () => {
    it('should update the role of a member', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner.generatedMaps[0],
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
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();
    });

    it('should update the role of a member within the space only', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayloadDto2 = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const space2Name = faker.word.noun();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const member2Name = nameBuilder();
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
        user: adminUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      // Add the user to space1
      await dbMembersRepository.insert({
        user: memberUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      // Add the user to space2
      await dbMembersRepository.insert({
        user: memberUser.generatedMaps[0],
        space: space2.generatedMaps[0],
        name: member2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
          authPayload: new AuthPayload(authPayloadDto),
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
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
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
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: userToUpdate.generatedMaps[0],
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
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
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
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: userToUpdate.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
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
        membersRepository.updateRole({
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
        membersRepository.updateRole({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if user does not have access to upgrade to ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
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
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: owner.generatedMaps[0],
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
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          role: 'ADMIN',
          userId: memberUserId,
        }),
      ).rejects.toThrow('No members found.');
    });

    it('should throw an error if downgrading the last ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: user.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.updateRole({
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
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const memberName2 = nameBuilder();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
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
        user: owner.generatedMaps[0],
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
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId: memberUserId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbMembersRepository.findOne({ where: { id: memberId } }),
      ).resolves.toBeNull();
    });

    it('should keep the user as a member of other spaces', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const space2Name = faker.word.noun();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const admin2Name = nameBuilder();
      const member2Name = nameBuilder();
      const owner = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: owner.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
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
        user: owner.generatedMaps[0],
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
        user: owner.generatedMaps[0],
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
          authPayload: new AuthPayload(authPayloadDto),
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
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: member2InvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should not allow removing a user if the user is not an ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
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
      await dbMembersRepository.insert({
        user: member.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeUser({
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
        membersRepository.removeUser({
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
        membersRepository.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId,
        }),
      ).rejects.toThrow('User not found.');
    });

    it('should throw an error if removing the last ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.generatedMaps[0].id;
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: user.generatedMaps[0],
        name: memberName,
        space: space.generatedMaps[0],
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId,
        }),
      ).rejects.toThrow('Cannot remove last admin.');
    });

    it('should throw an error if there are no members for the given space id', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: user.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const userId = user.generatedMaps[0].id;

      await expect(
        membersRepository.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId,
        }),
      ).rejects.toThrow('No members found.');
    });

    it('should throw an error if the user is not a member of the space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const admin = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: admin.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
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
        user: admin.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeUser({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
          userId: nonMemberUserId,
        }),
      ).rejects.toThrow('Member not found.');
    });
  });

  describe('removeSelf', () => {
    it('should remove the signer', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const memberName = nameBuilder();
      const signerUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: signerUser.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
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
        user: signerUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: adminName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMemberId = signerMember.identifiers[0].id;

      await expect(
        membersRepository.removeSelf({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbMembersRepository.findOne({ where: { id: signerMemberId } }),
      ).resolves.toBeNull();
    });

    it('should remove the signer even if they are not an ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const adminName = nameBuilder();
      const signerUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: signerUser.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
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
        user: signerUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: memberName,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });
      const signerMemberId = signerMember.identifiers[0].id;

      await expect(
        membersRepository.removeSelf({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).resolves.not.toThrow();

      await expect(
        dbMembersRepository.findOne({ where: { id: signerMemberId } }),
      ).resolves.toBeNull();
    });

    it('should keep the signer as a member of other spaces', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const space1Name = nameBuilder();
      const space2Name = faker.word.noun();
      const member1Name = nameBuilder();
      const member2Name = nameBuilder();
      const adminName = nameBuilder();
      const signerUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: signerUser.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
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
        user: signerUser.generatedMaps[0],
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
        user: signerUser.generatedMaps[0],
        space: space2.generatedMaps[0],
        name: member2Name,
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: signerMember2InvitedBy,
      });
      const signerMemberId2 = signerMember2.identifiers[0].id;

      await expect(
        membersRepository.removeSelf({
          authPayload: new AuthPayload(authPayloadDto),
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
        role: 'MEMBER',
        status: 'ACTIVE',
        invitedBy: signerMember2InvitedBy,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the signer is the last ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const signerMemberName = nameBuilder();
      const signerUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: signerUser.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
      const space = await dbSpacesRepository.insert({
        name: spaceName,
        status: 'ACTIVE',
      });
      const spaceId = space.generatedMaps[0].id;
      await dbMembersRepository.insert({
        user: signerUser.generatedMaps[0],
        space: space.generatedMaps[0],
        name: signerMemberName,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(
        membersRepository.removeSelf({
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Cannot remove last admin.');
    });

    it('should throw an error if the signer is not a member of the space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const adminName = nameBuilder();
      const signerUser = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      await dbWalletRepo.insert({
        user: signerUser.generatedMaps[0],
        address: authPayloadDto.signer_address,
      });
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
          authPayload: new AuthPayload(authPayloadDto),
          spaceId,
        }),
      ).rejects.toThrow('Member not found.');
    });
  });
});
