// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ConfigService } from '@nestjs/config';
import { DataSource, type Repository } from 'typeorm';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { CloudCosignerPolicy } from '@/modules/cloud-cosigner/datasources/entities/cloud-cosigner-policy.entity.db';
import { CloudCosignerReview } from '@/modules/cloud-cosigner/datasources/entities/cloud-cosigner-review.entity.db';
import { CloudCosignerRepository } from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository';
import { cloudCosignerPolicyBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-policy.builder';
import {
  PolicyRule,
  ReviewMode,
  ReviewStatus,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const STALE_AFTER_MS = 60_000;

describe('CloudCosignerRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let repository: CloudCosignerRepository;
  let dbPolicies: Repository<CloudCosignerPolicy>;
  let dbReviews: Repository<CloudCosignerReview>;

  const testDatabaseName = faker.string.alpha({ length: 10, casing: 'lower' });
  const testConfiguration = configuration();

  const dataSource = new DataSource({
    ...postgresConfig({
      ...testConfiguration.db.connection.postgres,
      type: 'postgres',
      database: testDatabaseName,
    }),
    migrationsTableName: testConfiguration.db.orm.migrationsTableName,
    entities: [CloudCosignerPolicy, CloudCosignerReview],
  });

  function reviewArgs(): {
    chainId: string;
    safeAddress: `0x${string}`;
    safeTxHash: Hex;
    stalePendingAfterMs: number;
  } {
    return {
      chainId: faker.string.numeric({ length: 3 }),
      safeAddress: getAddress(faker.finance.ethereumAddress()),
      safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
      stalePendingAfterMs: STALE_AFTER_MS,
    };
  }

  beforeAll(async () => {
    const adminDataSource = new DataSource({
      ...postgresConfig({
        ...testConfiguration.db.connection.postgres,
        type: 'postgres',
        database: 'postgres',
      }),
    });
    const adminService = new PostgresDatabaseService(
      mockLoggingService,
      adminDataSource,
    );
    await adminService.initializeDatabaseConnection();
    await adminService
      .getDataSource()
      .query(`CREATE DATABASE ${testDatabaseName}`);
    await adminService.destroyDatabaseConnection();

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

    repository = new CloudCosignerRepository(postgresDatabaseService);
    dbPolicies = dataSource.getRepository(CloudCosignerPolicy);
    dbReviews = dataSource.getRepository(CloudCosignerReview);
  });

  afterEach(async () => {
    await dbReviews.createQueryBuilder().delete().execute();
    await dbPolicies.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  describe('policies', () => {
    it('should return null for a Safe without a policy', async () => {
      await expect(
        repository.getPolicy({
          chainId: faker.string.numeric(),
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        }),
      ).resolves.toBeNull();
    });

    it('should insert then update the single policy row of a Safe', async () => {
      const { chainId, safeAddress } = reviewArgs();
      const first = cloudCosignerPolicyBuilder().build();
      const second = cloudCosignerPolicyBuilder()
        .with('instructions', null)
        .build();

      const inserted = await repository.upsertPolicy({
        chainId,
        safeAddress,
        policy: first,
      });
      const updated = await repository.upsertPolicy({
        chainId,
        safeAddress,
        policy: second,
      });

      expect(inserted).toMatchObject({ chainId, safeAddress, ...first });
      expect(updated).toMatchObject({ id: inserted.id, ...second });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        inserted.updatedAt.getTime(),
      );
      await expect(dbPolicies.count()).resolves.toBe(1);
      await expect(
        repository.getPolicy({ chainId, safeAddress }),
      ).resolves.toMatchObject({ ...second });
    });

    it('should scope policies by chain', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      await repository.upsertPolicy({
        chainId: '1',
        safeAddress,
        policy: cloudCosignerPolicyBuilder().build(),
      });

      await expect(
        repository.getPolicy({ chainId: '100', safeAddress }),
      ).resolves.toBeNull();
    });
  });

  describe('claimReview', () => {
    it('should create and claim a pending row for a new transaction', async () => {
      const args = reviewArgs();

      const claim = await repository.claimReview(args);

      expect(claim.claimed).toBe(true);
      expect(claim.review).toMatchObject({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        safeTxHash: args.safeTxHash,
        status: ReviewStatus.PENDING,
        mode: null,
        triggeredRules: [],
        riskFlags: [],
        signature: null,
      });
      await expect(dbReviews.count()).resolves.toBe(1);
    });

    it('should not hand a fresh pending row to a second worker', async () => {
      const args = reviewArgs();
      const first = await repository.claimReview(args);

      const second = await repository.claimReview(args);

      expect(second.claimed).toBe(false);
      expect(second.review.id).toBe(first.review.id);
      await expect(dbReviews.count()).resolves.toBe(1);
    });

    it.each([
      ReviewStatus.APPROVED,
      ReviewStatus.REJECTED,
      ReviewStatus.SKIPPED,
    ])('should not reclaim a %s review', async (status) => {
      const args = reviewArgs();
      const { review } = await repository.claimReview(args);
      await repository.completeReview({
        id: review.id,
        result: {
          status,
          mode: ReviewMode.RULES,
          triggeredRules: [],
          summary: faker.lorem.sentence(),
          riskFlags: [],
          model: null,
          signature: null,
        },
      });

      const again = await repository.claimReview(args);

      expect(again.claimed).toBe(false);
      expect(again.review.status).toBe(status);
    });

    it('should reclaim a failed review and reset it to pending', async () => {
      const args = reviewArgs();
      const { review } = await repository.claimReview(args);
      await repository.failReview({ id: review.id, summary: 'boom' });

      const again = await repository.claimReview(args);

      expect(again.claimed).toBe(true);
      expect(again.review).toMatchObject({
        id: review.id,
        status: ReviewStatus.PENDING,
        summary: null,
      });
    });

    it('should reclaim a pending review older than the stale threshold', async () => {
      const args = reviewArgs();
      const { review } = await repository.claimReview(args);
      // The updated_at trigger would undo a plain backdate.
      await dbReviews.query(
        `ALTER TABLE cloud_cosigner_reviews DISABLE TRIGGER update_updated_at`,
      );
      await dbReviews.query(
        `UPDATE cloud_cosigner_reviews SET updated_at = now() - interval '1 hour' WHERE id = $1`,
        [review.id],
      );
      await dbReviews.query(
        `ALTER TABLE cloud_cosigner_reviews ENABLE TRIGGER update_updated_at`,
      );

      const again = await repository.claimReview(args);

      expect(again.claimed).toBe(true);
      expect(again.review.id).toBe(review.id);
    });

    it('should treat the same hash on another chain as a separate review', async () => {
      const args = reviewArgs();
      await repository.claimReview(args);

      const other = await repository.claimReview({ ...args, chainId: '999' });

      expect(other.claimed).toBe(true);
      await expect(dbReviews.count()).resolves.toBe(2);
    });
  });

  describe('completeReview', () => {
    it('should persist the verdict and expose it through getReview', async () => {
      const args = reviewArgs();
      const { review } = await repository.claimReview(args);
      const signature = faker.string.hexadecimal({ length: 130 }) as Hex;

      const completed = await repository.completeReview({
        id: review.id,
        result: {
          status: ReviewStatus.APPROVED,
          mode: ReviewMode.LLM,
          triggeredRules: [PolicyRule.VALUE_OVER_THRESHOLD],
          summary: 'Looks like a routine payroll run.',
          riskFlags: [],
          model: 'claude-opus-5',
          signature,
        },
      });

      expect(completed).toMatchObject({
        status: ReviewStatus.APPROVED,
        mode: ReviewMode.LLM,
        triggeredRules: [PolicyRule.VALUE_OVER_THRESHOLD],
        model: 'claude-opus-5',
        signature,
      });
      await expect(
        repository.getReview({
          chainId: args.chainId,
          safeTxHash: args.safeTxHash,
        }),
      ).resolves.toMatchObject({
        id: review.id,
        status: ReviewStatus.APPROVED,
      });
    });

    it('should return null for an unknown transaction', async () => {
      await expect(
        repository.getReview({
          chainId: faker.string.numeric(),
          safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
        }),
      ).resolves.toBeNull();
    });
  });
});
