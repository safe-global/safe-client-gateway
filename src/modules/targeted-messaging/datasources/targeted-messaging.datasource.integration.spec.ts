import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { OutreachDbMapper } from '@/modules/targeted-messaging/datasources/entities/outreach.db.mapper';
import { SubmissionDbMapper } from '@/modules/targeted-messaging/datasources/entities/submission.db.mapper';
import { TargetedSafeDbMapper } from '@/modules/targeted-messaging/datasources/entities/targeted-safe.db.mapper';
import { TargetedMessagingDatasource } from '@/modules/targeted-messaging/datasources/targeted-messaging.datasource';
import { createOutreachDtoBuilder } from '@/modules/targeted-messaging/domain/entities/tests/create-outreach.dto.builder';
import { createTargetedSafesDtoBuilder } from '@/modules/targeted-messaging/domain/entities/tests/create-target-safes.dto.builder';
import { SubmissionNotFoundError } from '@/modules/targeted-messaging/domain/errors/submission-not-found.error';
import { TargetedSafeNotFoundError } from '@/modules/targeted-messaging/domain/errors/targeted-safe-not-found.error';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';
import type postgres from 'postgres';
import type { Address } from 'viem';
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

describe('TargetedMessagingDataSource tests', () => {
  let fakeCacheService: FakeCacheService;
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let target: TargetedMessagingDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
    });

    target = new TargetedMessagingDatasource(
      fakeCacheService,
      sql,
      mockLoggingService,
      new CachedQueryResolver(mockLoggingService, fakeCacheService),
      mockConfigurationService,
      new OutreachDbMapper(),
      new SubmissionDbMapper(),
      new TargetedSafeDbMapper(),
    );
  });

  beforeEach(async () => {
    await sql`TRUNCATE TABLE submissions, targeted_safes, outreaches CASCADE`;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('getUnprocessedOutreaches', () => {
    it('gets unprocessed outreaches successfully', async () => {
      const outreaches = [
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', faker.date.recent())
          .build(),
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', faker.date.recent())
          .build(),
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', null)
          .build(),
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', faker.date.recent())
          .build(),
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', null)
          .build(),
      ];
      for (const outreach of outreaches) {
        await target.createOutreach(outreach);
      }

      const result = await target.getUnprocessedOutreaches();

      // Only the outreaches with sourceFileProcessedDate as null are returned
      expect(result).toStrictEqual([
        expect.objectContaining(outreaches[2]),
        expect.objectContaining(outreaches[4]),
      ]);
    });
  });

  describe('createOutreach', () => {
    it('creates an outreach successfully', async () => {
      const dto = createOutreachDtoBuilder().build();

      const result = await target.createOutreach(dto);

      expect(result).toStrictEqual({
        id: expect.any(Number),
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        sourceId: dto.sourceId,
        type: dto.type,
        teamName: dto.teamName,
        sourceFile: dto.sourceFile,
        sourceFileProcessedDate: null,
        sourceFileChecksum: null,
        targetAll: dto.targetAll,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('throws if the creation fails', async () => {
      const dto = createOutreachDtoBuilder().build();

      await target.createOutreach(dto);

      // An outreach with the same name already exists
      await expect(target.createOutreach(dto)).rejects.toThrow(
        'Error creating outreach',
      );
    });
  });

  describe('getOutreachOrFail', () => {
    it('gets an outreach successfully', async () => {
      const dto = createOutreachDtoBuilder().build();
      const created = await target.createOutreach(dto);

      const result = await target.getOutreachOrFail(created.id);
      expect(result.targetAll).toStrictEqual(dto.targetAll);
    });

    it('throws if the outreach does not exist', async () => {
      const nonExistentId = faker.number.int({ min: 1000, max: 9999 });

      await expect(target.getOutreachOrFail(nonExistentId)).rejects.toThrow(
        'Outreach not found',
      );
    });
  });

  describe('updateOutreach', () => {
    it('should update an outreach successfully', async () => {
      const dto = createOutreachDtoBuilder().build();
      await target.createOutreach(dto);
      const updateOutreachDto = {
        sourceId: dto.sourceId,
        name: faker.string.alphanumeric(),
        startDate: faker.date.recent(),
        endDate: faker.date.recent(),
        teamName: faker.string.alphanumeric(),
        type: faker.string.alphanumeric(),
      };
      const result = await target.updateOutreach(updateOutreachDto);

      expect(result).toStrictEqual({
        id: expect.any(Number),
        name: updateOutreachDto.name,
        startDate: updateOutreachDto.startDate,
        endDate: updateOutreachDto.endDate,
        sourceId: updateOutreachDto.sourceId,
        type: updateOutreachDto.type,
        teamName: updateOutreachDto.teamName,
        sourceFile: dto.sourceFile,
        sourceFileProcessedDate: dto.sourceFileProcessedDate,
        sourceFileChecksum: dto.sourceFileChecksum,
        targetAll: dto.targetAll,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });
  });

  describe('createTargetedSafes', () => {
    it('adds targetedSafes successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();

      const result = await target.createTargetedSafes(createTargetedSafesDto);

      expect(result).toStrictEqual([
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: createTargetedSafesDto.addresses[0],
          chainId: null,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: createTargetedSafesDto.addresses[1],
          chainId: null,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]);
    });

    it('fails if the outreach does not exist', async () => {
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();

      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('fails if the Safe was already targeted in the same outreach', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [address, address])
        .build();

      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('fails if the Safe was already targeted in the same outreach (2)', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [address])
        .build();

      // Create the targeted safe
      const created = await target.createTargetedSafes(createTargetedSafesDto);
      expect(created).toHaveLength(1);

      // Fails when trying to create the same targeted safe
      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('adds targetedSafes with chainId successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address1 = getAddress(faker.finance.ethereumAddress());
      const address2 = getAddress(faker.finance.ethereumAddress());
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric();
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          { address: address1, chainId: chainId1 },
          { address: address2, chainId: chainId2 },
        ])
        .build();

      const result = await target.createTargetedSafes(createTargetedSafesDto);

      expect(result).toStrictEqual([
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: address1,
          chainId: chainId1,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: address2,
          chainId: chainId2,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]);
    });

    it('adds targetedSafes with mixed format (strings and objects)', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address1 = getAddress(faker.finance.ethereumAddress());
      const address2 = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [address1, { address: address2, chainId }])
        .build();

      const result = await target.createTargetedSafes(createTargetedSafesDto);

      expect(result).toStrictEqual([
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: address1,
          chainId: null,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: address2,
          chainId,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]);
    });

    it('allows same address for different chainIds', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId1 = faker.string.numeric({ length: { min: 1, max: 10 } });
      const chainId2 = faker.string.numeric({ length: { min: 11, max: 20 } });
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          { address, chainId: chainId1 },
          { address, chainId: chainId2 },
        ])
        .build();

      const result = await target.createTargetedSafes(createTargetedSafesDto);

      expect(result).toHaveLength(2);
      expect(result[0].address).toBe(address);
      expect(result[0].chainId).toBe(chainId1);
      expect(result[1].address).toBe(address);
      expect(result[1].chainId).toBe(chainId2);
    });

    it('fails if same address and chainId already targeted in the same outreach', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          { address, chainId },
          { address, chainId },
        ])
        .build();

      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('prevents creating both NULL and specific chain_id for same address+outreach', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();

      await target.createTargetedSafes(
        createTargetedSafesDtoBuilder()
          .with('outreachId', outreach.id)
          .with('addresses', [address])
          .build(),
      );

      // Try to create with specific chain_id - should fail due to exclusion constraint
      await expect(
        target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [{ address, chainId }])
            .build(),
        ),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('prevents creating both specific chain_id and NULL for same address+outreach (reverse order)', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();

      await target.createTargetedSafes(
        createTargetedSafesDtoBuilder()
          .with('outreachId', outreach.id)
          .with('addresses', [{ address, chainId }])
          .build(),
      );

      // Try to create with NULL chain_id - should fail due to exclusion constraint
      await expect(
        target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [address])
            .build(),
        ),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('should clear the cache on targetedSafes creation', async () => {
      let cacheContent: string | null;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          safeAddress,
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      await target.createTargetedSafes(createTargetedSafesDto);
      const cacheDir = new CacheDir(
        `targeted_messaging_targeted_safe_${outreach.id}`,
        `${safeAddress}_null`,
      );

      // cache is empty
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
      await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress,
      });
      // cache is updated
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);

      // second call is cached
      await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress,
      });

      // Clear the cache by creating new targetedSafes
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
      const anotherCreateTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      await target.createTargetedSafes(anotherCreateTargetedSafesDto);
      // cache is cleared
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();

      // third call is not cached
      await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress: createTargetedSafesDto.addresses[0] as Address,
      });
      // cache is updated
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
    });
  });

  describe('getTargetedSafe', () => {
    it('gets a targetedSafe successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          safeAddress,
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      const result = await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress,
      });

      expect(result).toStrictEqual({
        id: targetedSafes[0].id,
        address: targetedSafes[0].address,
        outreachId: outreach.id,
        chainId: null,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('gets a targetedSafe from cache', async () => {
      let cacheContent: string | null;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          safeAddress,
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const cacheDir = new CacheDir(
        `targeted_messaging_targeted_safe_${outreach.id}`,
        `${safeAddress}_null`,
      );

      // first call is not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
      await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress,
      });
      // cache is updated
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);

      // second call is cached
      const result = await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress,
      });

      expect(result).toStrictEqual(
        expect.objectContaining({
          id: targetedSafes[0].id,
          address: targetedSafes[0].address,
          outreachId: outreach.id,
        }),
      );
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
    });

    it('should not cache if the targetedSafe does not exist', async () => {
      let cacheContent: string | null;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const cacheDir = new CacheDir(
        `targeted_messaging_targeted_safe_${outreach.id}`,
        `${safeAddress}_null`,
      );

      // first call is not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
      await expect(
        target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
        }),
      ).rejects.toThrow(TargetedSafeNotFoundError);
      // second call is also not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
      await expect(
        target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
        }),
      ).rejects.toThrow(TargetedSafeNotFoundError);
      // cache is still empty
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
    });

    it('throws if the targetedSafe does not exist', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      await target.createTargetedSafes(createTargetedSafesDto);

      await expect(
        target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        }),
      ).rejects.toThrow(TargetedSafeNotFoundError);
    });

    describe('with chainId', () => {
      let outreach: { id: number };
      let safeAddress: Address;

      beforeEach(async () => {
        outreach = await target.createOutreach(
          createOutreachDtoBuilder().build(),
        );
        safeAddress = getAddress(faker.finance.ethereumAddress());
      });

      it('creates and gets a targetedSafe with specific chainId', async () => {
        const chainId = faker.number.int({ min: 1, max: 10000 }).toString();
        await target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [{ address: safeAddress, chainId }])
            .build(),
        );

        const result = await target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
          chainId,
        });

        expect(result).toMatchObject({
          address: safeAddress,
          outreachId: outreach.id,
          chainId,
        });
      });

      it('falls back to NULL chain_id when specific chain not found', async () => {
        const chainId = faker.number.int({ min: 1, max: 10000 }).toString();
        await target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [safeAddress]) // String format = NULL chain_id
            .build(),
        );

        const result = await target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
          chainId, // Looking for a specific chain, but only NULL exists
        });

        expect(result).toMatchObject({
          address: safeAddress,
          outreachId: outreach.id,
          chainId: null,
        });
      });

      it('distinguishes between different chainIds', async () => {
        const chainId1 = faker.number.int({ min: 1, max: 10000 }).toString();
        const chainId2 = faker.number.int({ min: 1, max: 10000 }).toString();

        await target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [
              { address: safeAddress, chainId: chainId1 },
              { address: safeAddress, chainId: chainId2 },
            ])
            .build(),
        );

        const resultChain1 = await target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
          chainId: chainId1,
        });

        const resultChain2 = await target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
          chainId: chainId2,
        });

        expect(resultChain1.chainId).toBe(chainId1);
        expect(resultChain2.chainId).toBe(chainId2);
      });

      it('uses separate cache keys for different chainIds', async () => {
        const chainId1 = faker.number.int({ min: 1, max: 10000 }).toString();
        const chainId2 = faker.number.int({ min: 1, max: 10000 }).toString();

        await target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [
              { address: safeAddress, chainId: chainId1 },
              { address: safeAddress, chainId: chainId2 },
            ])
            .build(),
        );

        const cacheDirChain1 = new CacheDir(
          `targeted_messaging_targeted_safe_${outreach.id}`,
          `${safeAddress}_${chainId1}`,
        );
        const cacheDirChain2 = new CacheDir(
          `targeted_messaging_targeted_safe_${outreach.id}`,
          `${safeAddress}_${chainId2}`,
        );

        // First call with chain 1 - not cached
        expect(await fakeCacheService.hGet(cacheDirChain1)).toBeNull();
        await target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
          chainId: chainId1,
        });
        // Cache for chain 1 is updated
        expect(
          JSON.parse((await fakeCacheService.hGet(cacheDirChain1)) as string),
        ).toHaveLength(1);

        // First call with chain 2 - not cached
        expect(await fakeCacheService.hGet(cacheDirChain2)).toBeNull();
        await target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
          chainId: chainId2,
        });
        // Cache for chain 2 is updated
        expect(
          JSON.parse((await fakeCacheService.hGet(cacheDirChain2)) as string),
        ).toHaveLength(1);
      });

      it('throws when chainId provided but no matching record exists', async () => {
        const chainId1 = faker.number.int({ min: 1, max: 10000 }).toString();
        const chainId2 = faker.number
          .int({ min: 10001, max: 20000 })
          .toString();
        await target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [{ address: safeAddress, chainId: chainId1 }])
            .build(),
        );

        // Looking for a different chain that doesn't exist
        await expect(
          target.getTargetedSafe({
            outreachId: outreach.id,
            safeAddress,
            chainId: chainId2,
          }),
        ).rejects.toThrow(TargetedSafeNotFoundError);
      });

      it('gets legacy NULL chainId when no chainId provided', async () => {
        await target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [safeAddress]) // String format = NULL chain_id
            .build(),
        );

        const result = await target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
        });

        expect(result).toMatchObject({
          address: safeAddress,
          outreachId: outreach.id,
          chainId: null,
        });
      });

      it('throws when chainId not provided and only chain-specific records exist', async () => {
        const chainId = faker.number.int({ min: 1, max: 10000 }).toString();
        await target.createTargetedSafes(
          createTargetedSafesDtoBuilder()
            .with('outreachId', outreach.id)
            .with('addresses', [{ address: safeAddress, chainId }])
            .build(),
        );

        // Looking without chainId should fail (no NULL record exists)
        await expect(
          target.getTargetedSafe({
            outreachId: outreach.id,
            safeAddress,
          }),
        ).rejects.toThrow(TargetedSafeNotFoundError);
      });
    });
  });

  describe('getSubmission', () => {
    it('creates a submission successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      const result = await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(result).toStrictEqual({
        id: expect.any(Number),
        outreachId: outreach.id,
        targetedSafeId: targetedSafes[0].id,
        signerAddress,
        completionDate: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('gets a submission successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      const result = await target.getSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(result).toStrictEqual({
        id: expect.any(Number),
        outreachId: outreach.id,
        targetedSafeId: targetedSafes[0].id,
        signerAddress,
        completionDate: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('gets a submission from cache', async () => {
      let cacheContent: string | null;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const cacheDir = new CacheDir(
        `targeted_messaging_submission_${outreach.id}`,
        `${createTargetedSafesDto.addresses[0] as Address}_${signerAddress}_null`,
      );

      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      // first call is not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
      await target.getSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });
      // second call is cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
      const result = await target.getSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(result).toStrictEqual({
        id: expect.any(Number),
        outreachId: outreach.id,
        targetedSafeId: targetedSafes[0].id,
        signerAddress,
        completionDate: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('throws if the submission does not exist', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      await expect(
        target.getSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress: getAddress(faker.finance.ethereumAddress()),
        }),
      ).rejects.toThrow(SubmissionNotFoundError);
    });

    it('should not cache if the submission does not exist', async () => {
      let cacheContent: string | null;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const cacheDir = new CacheDir(
        `targeted_messaging_submission_${outreach.id}`,
        `${createTargetedSafesDto.addresses[0] as Address}_${signerAddress}_null`,
      );

      // first call is not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
      await expect(
        target.getSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress,
        }),
      ).rejects.toThrow(SubmissionNotFoundError);
      // second call is also not  cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
      await expect(
        target.getSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress,
        }),
      ).rejects.toThrow(SubmissionNotFoundError);
      // cache is still empty
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeNull();
    });

    it('throws if trying to create a submission for the same targetedSafe and signerAddress', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      // First submission
      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      // Second submission - same targetedSafe and signerAddress
      await expect(
        target.createSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress,
        }),
      ).rejects.toThrow('Error creating submission');
    });

    it('uses separate cache keys for different chainIds', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric();

      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDtoBuilder()
          .with('outreachId', outreach.id)
          .with('addresses', [
            { address: safeAddress, chainId: chainId1 },
            { address: safeAddress, chainId: chainId2 },
          ])
          .build(),
      );

      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });
      await target.createSubmission({
        targetedSafe: targetedSafes[1],
        signerAddress,
      });

      // Verify separate cache keys
      const cacheDir1 = new CacheDir(
        `targeted_messaging_submission_${outreach.id}`,
        `${safeAddress}_${signerAddress}_${chainId1}`,
      );
      const cacheDir2 = new CacheDir(
        `targeted_messaging_submission_${outreach.id}`,
        `${safeAddress}_${signerAddress}_${chainId2}`,
      );

      expect(await fakeCacheService.hGet(cacheDir1)).toBeNull();
      const submission1 = await target.getSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(
        JSON.parse((await fakeCacheService.hGet(cacheDir1)) as string),
      ).toHaveLength(1);

      expect(await fakeCacheService.hGet(cacheDir2)).toBeNull();
      const submission2 = await target.getSubmission({
        targetedSafe: targetedSafes[1],
        signerAddress,
      });
      expect(
        JSON.parse((await fakeCacheService.hGet(cacheDir2)) as string),
      ).toHaveLength(1);

      expect(submission1.targetedSafeId).toBe(targetedSafes[0].id);
      expect(submission2.targetedSafeId).toBe(targetedSafes[1].id);
      expect(submission1.targetedSafeId).not.toBe(submission2.targetedSafeId);
    });
  });
});
