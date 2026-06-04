// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type postgres from 'postgres';
import type { MockedObject } from 'vitest';
import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseMigrationHook } from '@/datasources/db/v1/postgres-database.migration.hook';
import type { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import type { ILoggingService } from '@/logging/logging.interface';

const migrator = vi.mocked({
  migrate: vi.fn(),
} as MockedObject<PostgresDatabaseMigrator>);

const loggingService = vi.mocked({
  error: vi.fn(),
  info: vi.fn(),
} as MockedObject<ILoggingService>);

const configurationService = vi.mocked({
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>);

describe('PostgresDatabaseMigrationHook tests', () => {
  let sql: postgres.Sql;
  let target: PostgresDatabaseMigrationHook;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not run migrations', async () => {
    configurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'application.runMigrations') return false;
    });
    target = new PostgresDatabaseMigrationHook(
      sql,
      migrator,
      loggingService,
      configurationService,
    );

    await target.onModuleInit();

    expect(loggingService.info).toHaveBeenCalledWith(
      'Database migrations are disabled',
    );
  });

  it('should run migrations', async () => {
    configurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'application.runMigrations') return true;
    });
    const executed = [
      {
        path: faker.system.filePath(),
        id: faker.number.int(),
        name: faker.string.sample(),
      },
      {
        path: faker.system.filePath(),
        id: faker.number.int(),
        name: faker.string.sample(),
      },
    ];
    migrator.migrate.mockResolvedValue(executed);
    target = new PostgresDatabaseMigrationHook(
      sql,
      migrator,
      loggingService,
      configurationService,
    );

    await target.onModuleInit();

    expect(loggingService.info).toHaveBeenCalledTimes(2);
    expect(loggingService.info).toHaveBeenCalledWith('Checking migrations');
    expect(loggingService.info).toHaveBeenCalledWith(
      `Pending migrations executed: [${executed[0].name}, ${executed[1].name}]`,
    );
  });
});
