import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { getAddress, maxUint256 } from 'viem';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { UserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { OrganizationSafesRepository } from '@/domain/organizations/organizations-safe.repository';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { NotFoundException } from '@nestjs/common';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const OrganizationStatusKeys = getStringEnumKeys(OrganizationStatus);

describe('OrganizationSafesRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let orgSafesRepo: OrganizationSafesRepository;

  let dbWalletRepo: Repository<Wallet>;
  let dbUserRepo: Repository<User>;
  let dbOrgRepo: Repository<Organization>;
  let dbUserOrgRepo: Repository<UserOrganization>;
  let dbOrgSafeRepo: Repository<OrganizationSafe>;

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
    entities: [UserOrganization, Organization, OrganizationSafe, User, Wallet],
  });

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

    orgSafesRepo = new OrganizationSafesRepository(postgresDatabaseService);

    dbWalletRepo = dataSource.getRepository(Wallet);
    dbUserRepo = dataSource.getRepository(User);
    dbOrgRepo = dataSource.getRepository(Organization);
    dbUserOrgRepo = dataSource.getRepository(UserOrganization);
    dbOrgSafeRepo = dataSource.getRepository(OrganizationSafe);
  });

  afterEach(async () => {
    jest.resetAllMocks();

    await Promise.all(
      [dbWalletRepo, dbUserRepo, dbOrgRepo, dbUserOrgRepo, dbOrgSafeRepo].map(
        async (repo) => {
          await repo.createQueryBuilder().delete().where('1=1').execute();
        },
      ),
    );
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  // As the triggers are set on the database level, Jest's fake timers are not accurate
  describe('createdAt/updatedAt', () => {
    it('should set createdAt and updatedAt when creating a OrganizationSafe', async () => {
      const before = new Date().getTime();
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(OrganizationStatusKeys),
        name: faker.word.noun(),
      });
      const orgSafe = await dbOrgSafeRepo.insert({
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        organization: org.identifiers[0].id,
      });

      const after = new Date().getTime();

      const createdAt = orgSafe.generatedMaps[0].createdAt;
      const updatedAt = orgSafe.generatedMaps[0].updatedAt;

      if (!(createdAt instanceof Date) || !(updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt).toEqual(updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(createdAt.getTime()).toBeLessThanOrEqual(after);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a OrganizationSafe', async () => {
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const prevOrgSafe = await dbOrgSafeRepo.insert({
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        organization: org.identifiers[0].id,
      });
      const orgSafeId = prevOrgSafe.identifiers[0].id as OrganizationSafe['id'];
      await dbOrgSafeRepo.update(orgSafeId, {
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const updatedOrgSafe = await dbOrgSafeRepo.findOneOrFail({
        where: { id: orgSafeId },
      });

      const prevUpdatedAt = prevOrgSafe.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(
        updatedOrgSafe.updatedAt.getTime(),
      );
    });
  });

  describe('chain_id', () => {
    it('should not allow a chain_id to be longer than uint256 (78 chars)', async () => {
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      await expect(
        dbOrgSafeRepo.insert({
          chainId: (maxUint256 * BigInt(10)).toString(), // 79 chars
          address: getAddress(faker.finance.ethereumAddress()),
          organization: org.identifiers[0].id,
        }),
      ).rejects.toThrow('value too long');
    });
  });

  describe('address', () => {
    it('should store non-checksummed addresses, checksummed', async () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);

      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const insertOrgSafeResult = await dbOrgSafeRepo.insert({
        chainId: faker.string.numeric(),
        address: nonChecksummedAddress as OrganizationSafe['address'],
        organization: org.identifiers[0].id,
      });
      const orgSafe = await dbOrgSafeRepo.findOneOrFail({
        where: {
          id: insertOrgSafeResult.identifiers[0].id as OrganizationSafe['id'],
        },
      });

      expect(orgSafe.address).toEqual(checksummedAddress);
    });

    it('should update non-checksummed addresses, checksummed', async () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);

      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const insertOrgSafeResult = await dbOrgSafeRepo.insert({
        chainId: faker.string.numeric(),
        address: checksummedAddress,
        organization: org.identifiers[0].id,
      });
      const insertedOrgSafeId = insertOrgSafeResult.identifiers[0]
        .id as OrganizationSafe['id'];

      await dbOrgSafeRepo.update(insertedOrgSafeId, {
        address: nonChecksummedAddress as OrganizationSafe['address'],
      });

      const orgSafe = await dbOrgSafeRepo.findOneOrFail({
        where: {
          id: insertedOrgSafeId,
        },
      });

      expect(orgSafe.address).toEqual(checksummedAddress);
    });
  });

  describe('create', () => {
    it('should create an OrganizationSafe', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepo.insert({
        user: { id: userId },
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      await dbUserOrgRepo.insert({
        user: { id: userId },
        role: 'ADMIN',
        status: 'ACTIVE',
        name: faker.word.noun(),
        organization: { id: orgId },
      });

      await orgSafesRepo.create({
        organizationId: orgId,
        payload: [
          {
            chainId,
            address,
          },
        ],
      });

      await expect(
        dbOrgSafeRepo.find({
          where: { chainId, address },
        }),
      ).resolves.toEqual([
        {
          id: expect.any(Number),
          chainId,
          address,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should create multiple OrganizationSafes', async () => {
      const payload = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepo.insert({
        user: { id: userId },
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      await dbUserOrgRepo.insert({
        user: { id: userId },
        role: 'ADMIN',
        status: 'ACTIVE',
        name: faker.word.noun(),
        organization: { id: orgId },
      });

      await orgSafesRepo.create({
        organizationId: orgId,
        payload,
      });

      await expect(dbOrgSafeRepo.find()).resolves.toEqual(
        payload.map(({ chainId, address }) => ({
          id: expect.any(Number),
          chainId,
          address,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })),
      );
    });
  });

  describe('findByOrganizationId', () => {
    it('should return found organization Safes', async () => {
      const orgSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      await Promise.all(
        orgSafes.map(({ chainId, address }) => {
          return dbOrgSafeRepo.insert({
            chainId,
            address,
            organization: { id: orgId },
          });
        }),
      );

      await expect(orgSafesRepo.findByOrganizationId(orgId)).resolves.toEqual(
        expect.arrayContaining(orgSafes),
      );
    });

    it('should return empty array if no organization Safes found', async () => {
      await expect(
        orgSafesRepo.findByOrganizationId(
          faker.number.int({ max: DB_MAX_SAFE_INTEGER }),
        ),
      ).resolves.toEqual([]);
    });
  });

  describe('findOrFail', () => {
    it('should return found organizations Safes', async () => {
      const orgSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      await Promise.all(
        orgSafes.map(({ chainId, address }) => {
          return dbOrgSafeRepo.insert({
            chainId,
            address,
            organization: { id: orgId },
          });
        }),
      );

      await expect(
        orgSafesRepo.findOrFail({
          where: { organization: { id: orgId } },
        }),
      ).resolves.toEqual(
        expect.arrayContaining(
          orgSafes.map(({ chainId, address }) => ({
            id: expect.any(Number),
            chainId,
            address,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })),
        ),
      );
    });

    it('should throw NotFoundException if no organizations Safes found', async () => {
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];

      await expect(
        orgSafesRepo.findOrFail({
          where: { organization: { id: orgId } },
        }),
      ).rejects.toThrow(new NotFoundException('Organization has no Safes.'));
    });
  });

  describe('find', () => {
    it('should return found organization Safes', async () => {
      const orgSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      await orgSafesRepo.create({
        organizationId: orgId,
        payload: orgSafes,
      });

      await expect(
        orgSafesRepo.find({
          where: { organization: { id: orgId } },
        }),
      ).resolves.toEqual(
        orgSafes.map(({ chainId, address }) => ({
          id: expect.any(Number),
          chainId,
          address,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })),
      );
    });

    it('should return empty array if no organization Safes found', async () => {
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];

      expect(
        await orgSafesRepo.find({
          where: { organization: { id: orgId } },
        }),
      ).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete an OrganizationSafe', async () => {
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      const orgSafe = await dbOrgSafeRepo.insert({
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        organization: {
          id: orgId,
        },
      });
      const orgSafeId = orgSafe.identifiers[0].id as OrganizationSafe['id'];

      const orgSafeBefore = await orgSafesRepo.findOrFail({
        where: { id: orgSafeId },
      });

      await orgSafesRepo.delete({
        organizationId: orgId,
        payload: [
          {
            chainId: orgSafeBefore[0].chainId,
            address: orgSafeBefore[0].address,
          },
        ],
      });

      expect(orgSafeBefore).toHaveLength(1);
      await expect(
        orgSafesRepo.findOrFail({
          where: { organization: { id: orgId } },
        }),
      ).rejects.toThrow(new NotFoundException('Organization has no Safes.'));
    });

    it('should delete multiple OrganizationSafes', async () => {
      const orgSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      await orgSafesRepo.create({
        organizationId: orgId,
        payload: orgSafes,
      });
      const orgSafeBefore = await orgSafesRepo.findByOrganizationId(orgId);

      await orgSafesRepo.delete({
        organizationId: orgId,
        payload: orgSafes,
      });

      expect(orgSafeBefore).toHaveLength(orgSafes.length);
      await expect(
        orgSafesRepo.findOrFail({
          where: { organization: { id: orgId } },
        }),
      ).rejects.toThrow(new NotFoundException('Organization has no Safes.'));
    });

    it('should throw NotFoundException if provided OrganizationSafe is not found', async () => {
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      const chainId = faker.string.numeric();
      await dbOrgSafeRepo.insert({
        chainId,
        address: getAddress(faker.finance.ethereumAddress()),
        organization: {
          id: orgId,
        },
      });

      await expect(
        orgSafesRepo.delete({
          organizationId: orgId,
          payload: [
            {
              chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).rejects.toThrow(new NotFoundException('Organization has no Safes.'));
    });

    it('should throw NotFoundException if none of the provided OrganizationSafes is found', async () => {
      const orgSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      await orgSafesRepo.create({
        organizationId: orgId,
        payload: orgSafes,
      });

      const orgSafeBefore = await orgSafesRepo.findByOrganizationId(orgId);
      expect(orgSafeBefore).toHaveLength(orgSafes.length);

      // None is found
      await expect(
        orgSafesRepo.delete({
          organizationId: orgId,
          payload: [
            {
              chainId: faker.string.numeric(),
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).rejects.toThrow(new NotFoundException('Organization has no Safes.'));
    });

    it('should delete found OrganizationSafes and ignore not found', async () => {
      const orgSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const org = await dbOrgRepo.insert({
        status: faker.helpers.arrayElement(
          getStringEnumKeys(OrganizationStatus),
        ),
        name: faker.word.noun(),
      });
      const orgId = org.identifiers[0].id as Organization['id'];
      await orgSafesRepo.create({
        organizationId: orgId,
        payload: orgSafes,
      });

      // Some are found
      await expect(
        orgSafesRepo.delete({
          organizationId: orgId,
          payload: [
            {
              chainId: orgSafes[0].chainId,
              address: orgSafes[0].address,
            },
            {
              chainId: faker.string.numeric(),
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).resolves.toBeUndefined();
    });
  });
});
