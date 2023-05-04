import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import { CacheDir } from '../../datasources/cache/entities/cache-dir.entity';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '../../domain/contracts/entities/__tests__/contract.builder';
import { pageBuilder } from '../../domain/entities/__tests__/page.builder';
import {
  erc20TransferBuilder,
  toJson,
} from '../../domain/safe/entities/__tests__/erc20-transfer.builder';
import { safeBuilder } from '../../domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '../../domain/tokens/__tests__/token.builder';
import { ValidationModule } from '../../validation/validation.module';
import { ChainsModule } from '../chains/chains.module';
import { ContractsModule } from '../contracts/contracts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { invalidationPatternDetailsBuilder } from './entities/__tests__/invalidation-pattern-details.dto.builder';
import { invalidationPatternDtoBuilder } from './entities/__tests__/invalidation-pattern.dto.builder';
import { FlushModule } from './flush.module';

describe('Flush Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigApiUrl: string;
  const authToken = faker.datatype.uuid();

  beforeAll(async () => {
    safeConfigApiUrl = faker.internet.url();
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigApiUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set('exchange.apiKey', faker.datatype.uuid());
    fakeConfigurationService.set('auth.token', authToken);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        FlushModule,
        ChainsModule,
        ContractsModule,
        TransactionsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Execute selective cache invalidations', () => {
    it('should throw an error if authorization is not sent in the request headers', async () => {
      await request(app.getHttpServer()).post('/v2/flush').send({}).expect(403);
    });

    it('should throw an error for a malformed request', async () => {
      await request(app.getHttpServer())
        .post('/v2/flush')
        .set('Authorization', `Basic ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should throw an error if a bad pattern detail is provided when invalidating tokens', async () => {
      await request(app.getHttpServer())
        .post('/v2/flush')
        .set('Authorization', `Basic ${authToken}`)
        .send({
          ...invalidationPatternDtoBuilder()
            .with('invalidate', 'tokens')
            .build(),
          patternDetails: 3,
        })
        .expect(400)
        .expect({ message: 'Validation failed', code: 42, arguments: [] });
    });

    it('should invalidate chains', async () => {
      const chains = [
        chainBuilder().with('chainId', '1').build(),
        chainBuilder().with('chainId', '2').build(),
      ];
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigApiUrl}/api/v1/chains`:
            return Promise.resolve({
              data: pageBuilder().with('results', chains).build(),
            });
          case `${safeConfigApiUrl}/api/v1/chains/${chains[0].chainId}`:
            return Promise.resolve({ data: chains[0] });
          case `${safeConfigApiUrl}/api/v1/chains/${chains[1].chainId}`:
            return Promise.resolve({ data: chains[1] });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      // fill cache by requesting chains
      await request(app.getHttpServer()).get('/v1/chains');
      await request(app.getHttpServer()).get(`/v1/chains/${chains[0].chainId}`);
      await request(app.getHttpServer()).get(`/v1/chains/${chains[1].chainId}`);

      // check the cache is filled
      expect(fakeCacheService.keyCount()).toBe(3);

      // execute flush
      await request(app.getHttpServer())
        .post('/v2/flush')
        .set('Authorization', `Basic ${authToken}`)
        .send(
          invalidationPatternDtoBuilder().with('invalidate', 'Chains').build(),
        )
        .expect(200);

      // check the cache is empty
      expect(fakeCacheService.keyCount()).toBe(0);
    });

    it('should invalidate contracts', async () => {
      const chain = chainBuilder().build();
      const contracts = [contractBuilder().build(), contractBuilder().build()];
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigApiUrl}/api/v1/chains`:
            return Promise.resolve({
              data: pageBuilder().with('results', [chain]).build(),
            });
          case `${safeConfigApiUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/contracts/${contracts[0].address}`:
            return Promise.resolve({ data: contracts[0] });
          case `${chain.transactionService}/api/v1/contracts/${contracts[1].address}`:
            return Promise.resolve({ data: contracts[1] });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      // fill cache by requesting contracts
      await request(app.getHttpServer()).get(
        `/v1/chains/${chain.chainId}/contracts/${contracts[0].address}`,
      );
      await request(app.getHttpServer()).get(
        `/v1/chains/${chain.chainId}/contracts/${contracts[1].address}`,
      );

      // check the cache is filled
      await Promise.all(
        contracts.map(async (contract) =>
          expect(
            await fakeCacheService.get(
              new CacheDir(`${chain.chainId}_contract_${contract.address}`, ''),
            ),
          ).toBeDefined(),
        ),
      );

      // execute flush
      await request(app.getHttpServer())
        .post('/v2/flush')
        .set('Authorization', `Basic ${authToken}`)
        .send(
          invalidationPatternDtoBuilder()
            .with('invalidate', 'Contracts')
            .with('patternDetails', null)
            .build(),
        )
        .expect(200);

      // check the contracts are flushed
      await Promise.all(
        contracts.map(async (contract) =>
          expect(
            await fakeCacheService.get(
              new CacheDir(`${chain.chainId}_contract_${contract.address}`, ''),
            ),
          ).toBeUndefined(),
        ),
      );

      // check the chains remain
      expect(
        await fakeCacheService.get(new CacheDir(`${chain.chainId}_chain`, '')),
      ).toBeDefined();
    });

    it('should invalidate tokens', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const tokens = [tokenBuilder().build(), tokenBuilder().build()];
      const transfers = pageBuilder()
        .with('results', [
          toJson(
            erc20TransferBuilder()
              .with('tokenAddress', tokens[0].address)
              .build(),
          ),
          toJson(
            erc20TransferBuilder()
              .with('tokenAddress', tokens[1].address)
              .build(),
          ),
        ])
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigApiUrl}/api/v1/chains`:
            return Promise.resolve({
              data: pageBuilder().with('results', [chain]).build(),
            });
          case `${safeConfigApiUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe });
          case `${chain.transactionService}/api/v1/tokens/${tokens[0].address}`:
            return Promise.resolve({ data: tokens[0] });
          case `${chain.transactionService}/api/v1/tokens/${tokens[1].address}`:
            return Promise.resolve({ data: tokens[1] });
          case `${chain.transactionService}/api/v1/safes/${safe.address}/incoming-transfers/`:
            return Promise.resolve({ data: transfers });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      // fill tokens cache by requesting transfers
      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers`,
        )
        .expect(200);

      // check the cache is filled
      await Promise.all(
        tokens.map(async (token) =>
          expect(
            await fakeCacheService.get(
              new CacheDir(`${chain.chainId}_token_${token.address}`, ''),
            ),
          ).toBeDefined(),
        ),
      );

      // execute flush
      await request(app.getHttpServer())
        .post('/v2/flush')
        .set('Authorization', `Basic ${authToken}`)
        .send(
          invalidationPatternDtoBuilder()
            .with('invalidate', 'Tokens')
            .with(
              'patternDetails',
              invalidationPatternDetailsBuilder()
                .with('chain_id', chain.chainId)
                .build(),
            )
            .build(),
        )
        .expect(200);

      // check the tokens are flushed
      await Promise.all(
        tokens.map(async (token) =>
          expect(
            await fakeCacheService.get(
              new CacheDir(`${chain.chainId}_token_${token.address}`, ''),
            ),
          ).toBeUndefined(),
        ),
      );

      // check the chain and safe remain
      expect(
        await fakeCacheService.get(new CacheDir(`${chain.chainId}_chain`, '')),
      ).toBeDefined();
      expect(
        await fakeCacheService.get(
          new CacheDir(`${chain.chainId}_safe_${safe.address}`, ''),
        ),
      ).toBeDefined();
    });
  });
});
