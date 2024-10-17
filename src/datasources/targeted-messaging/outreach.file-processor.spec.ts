import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { CachedQueryResolver } from '@/datasources/db/cached-query-resolver';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { TargetedMessagingDatasource } from '@/datasources/targeted-messaging/targeted-messaging.datasource';
import { createOutreachDtoBuilder } from '@/domain/targeted-messaging/entities/tests/create-outreach.dto.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';
import type postgres from 'postgres';
import { OutreachFileProcessor } from './outreach.file-processor';
import path from 'path';
import { rm, writeFile } from 'fs/promises';
import { createHash } from 'crypto';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('OutreachFileProcessor', () => {
  let fakeCacheService: FakeCacheService;
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let fileProcessor: OutreachFileProcessor;
  let targetedMessagingDatasource: TargetedMessagingDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
    });

    targetedMessagingDatasource = new TargetedMessagingDatasource(
      fakeCacheService,
      sql,
      mockLoggingService,
      new CachedQueryResolver(mockLoggingService, fakeCacheService),
      mockConfigurationService,
    );

    fileProcessor = new OutreachFileProcessor(
      mockLoggingService,
      fakeCacheService,
      targetedMessagingDatasource,
    );
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE submissions, targeted_safes, outreaches CASCADE`;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  it('should not process Outreach data files of the lock is set', async () => {
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder().build(),
    );
    await fakeCacheService.hSet(lockCacheKey, 'true', 10);
    await fileProcessor.onModuleInit();

    const result = await targetedMessagingDatasource.getUnprocessedOutreaches();

    expect(result).toHaveLength(1);
  });

  it('should not process Outreach data files with bad checksum', async () => {
    const filePath = path.resolve('src', '__tests__', 'test.json');
    const dataString = JSON.stringify({ bad: 'data' });
    await writeFile(filePath, dataString, 'utf-8');
    const hash = createHash('sha256');
    hash.update(dataString);
    const checksum = hash.digest('hex');
    await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceFile', filePath)
        .with('sourceFileChecksum', checksum)
        .build(),
    );

    try {
      const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
      await fakeCacheService.deleteByKey(lockCacheKey.key);
      await fileProcessor.onModuleInit();

      const result =
        await targetedMessagingDatasource.getUnprocessedOutreaches();

      expect(result).toHaveLength(0);
      expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
    } finally {
      await rm(filePath);
    }
  });

  it.skip('should process Outreach data files of the lock is not set and release the lock', async () => {
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder().build(),
    );
    await fakeCacheService.deleteByKey(lockCacheKey.key);
    await fileProcessor.onModuleInit();

    const result = await targetedMessagingDatasource.getUnprocessedOutreaches();

    expect(result).toHaveLength(0);
    expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
  });
});
