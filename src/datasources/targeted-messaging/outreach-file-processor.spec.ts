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
import path from 'path';
import type postgres from 'postgres';
import { OutreachFileProcessor } from './outreach-file-processor';
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
  const baseDir = 'assets/targeted-messaging';
  const fileName = 'sample.json';
  const fileChecksum =
    'f1cd6d9c293d46143c944aa11fa0383aae90307ff770a6a9cde510ff6326de01';
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
      if (key === 'targetedMessaging.fileStorage.type') return 'local';
      if (key === 'targetedMessaging.fileStorage.baseDir') return baseDir;
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
      mockConfigurationService,
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

    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(1);
  });

  it('should fail if the Outreach does not have a sourceFile set', async () => {
    const expectedChecksum = faker.string.alphanumeric();
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceFile', null)
        .with('sourceFileChecksum', expectedChecksum)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(1);
    expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      `Error parsing Outreach ${created.id} data file: No source file`,
    );
  });

  it('should not process Outreach data files with bad checksum', async () => {
    const sourceFile = path.resolve(baseDir, fileName);
    const expectedChecksum = faker.string.alphanumeric();
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', expectedChecksum)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(1);
    expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      `Error parsing Outreach ${created.id} data file: Checksum expected ${expectedChecksum}, but found ${fileChecksum}`,
    );
  });

  it('should fail if the Outreach data file is not a JSON', async () => {
    const badSourceFile = path.resolve(baseDir, 'yaml.yaml');
    try {
      const content = 'yaml: yaml';
      const hash = createHash('sha256');
      hash.update(content);
      const checksum = hash.digest('hex');
      await writeFile(badSourceFile, content);
      await targetedMessagingDatasource.createOutreach(
        createOutreachDtoBuilder()
          .with('sourceFile', badSourceFile)
          .with('sourceFileChecksum', checksum)
          .build(),
      );
      const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
      await fakeCacheService.deleteByKey(lockCacheKey.key);

      await fileProcessor.onModuleInit();

      expect(
        await targetedMessagingDatasource.getUnprocessedOutreaches(),
      ).toHaveLength(1);
      expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.stringContaining('is not valid JSON'),
      );
    } finally {
      await rm(badSourceFile);
    }
  });

  it('should validate process Outreach data files', async () => {
    const badSourceFile = path.resolve(baseDir, 'bad.json');
    try {
      const content = '{ "bad": "json" }';
      const hash = createHash('sha256');
      hash.update(content);
      const checksum = hash.digest('hex');
      await writeFile(badSourceFile, content);
      const created = await targetedMessagingDatasource.createOutreach(
        createOutreachDtoBuilder()
          .with('sourceFile', badSourceFile)
          .with('sourceFileChecksum', checksum)
          .build(),
      );
      const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
      await fakeCacheService.deleteByKey(lockCacheKey.key);

      await fileProcessor.onModuleInit();

      expect(
        await targetedMessagingDatasource.getUnprocessedOutreaches(),
      ).toHaveLength(1);
      expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error parsing Outreach ${created.id} data file`,
        ),
      );
    } finally {
      await rm(badSourceFile);
    }
  });

  it('should update the Outreach accordingly to the data file', async () => {
    const sourceFile = path.resolve(baseDir, fileName);
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceId', 1)
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', fileChecksum)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    // assert the Outreach was updated with the contents of the data file
    const [updated] =
      await sql`SELECT * FROM outreaches WHERE id = ${created.id}`;
    expect(updated.name).toBe('test_wallet_campaign');
    expect(updated.team_name).toBe('test_team_name');
    expect(updated.start_date).toStrictEqual(new Date('2024-10-21'));
    expect(updated.end_date).toStrictEqual(new Date('2024-10-28'));
  });

  it('should add the Targeted Safes present in the data file', async () => {
    const sourceFile = path.resolve(baseDir, fileName);
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceId', 1)
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', fileChecksum)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    // assert the Targeted Safes were created
    const targetedSafes =
      await sql`SELECT * FROM targeted_safes WHERE outreach_id = ${created.id}`;
    expect(targetedSafes).toHaveLength(10);
    expect(
      targetedSafes.every(
        (targetedSafe) => targetedSafe.outreach_id === created.id,
      ),
    ).toBeTruthy();
  });

  it('should mark the Outreach as processed and release the lock', async () => {
    const sourceFile = path.resolve(baseDir, fileName);
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceId', 1)
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', fileChecksum)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    // assert the Outreach was marked as processed
    const [updated] =
      await sql`SELECT * FROM outreaches WHERE id = ${created.id}`;
    expect(updated.source_file_processed_date).not.toBeNull();
    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(0);
    expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
  });
});
