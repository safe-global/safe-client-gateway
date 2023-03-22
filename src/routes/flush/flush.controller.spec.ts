import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import { CacheRouter } from '../../datasources/cache/cache.router';
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
import { invalidationPatternDtoBuilder } from './entities/__tests__/invalidation-pattern.dto.builder';
import { FlushModule } from './flush.module';

describe('Flush Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigApiUrl: string;

  beforeAll(async () => {
    safeConfigApiUrl = faker.internet.url();
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigApiUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set('exchange.apiKey', faker.datatype.uuid());
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
    it('should throw an error for a malformed request', async () => {
      await request(app.getHttpServer()).post('/v2/flush').send({}).expect(400);
    });

    it('should invalidate chains', async () => {
      const chains = [chainBuilder().build(), chainBuilder().build()];
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
        .send(
          invalidationPatternDtoBuilder().with('invalidate', 'chains').build(),
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
              CacheRouter.getContractCacheDir(chain.chainId, contract.address),
            ),
          ).toBeDefined(),
        ),
      );

      // execute flush
      await request(app.getHttpServer())
        .post('/v2/flush')
        .send(
          invalidationPatternDtoBuilder()
            .with('invalidate', 'contracts')
            .build(),
        )
        .expect(200);

      // check the contracts are flushed
      await Promise.all(
        contracts.map(async (contract) =>
          expect(
            await fakeCacheService.get(
              CacheRouter.getContractCacheDir(chain.chainId, contract.address),
            ),
          ).toBeUndefined(),
        ),
      );

      // check the chains remain
      expect(
        await fakeCacheService.get(CacheRouter.getChainCacheDir(chain.chainId)),
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
              CacheRouter.getTokenCacheDir(chain.chainId, token.address),
            ),
          ).toBeDefined(),
        ),
      );

      // execute flush
      await request(app.getHttpServer())
        .post('/v2/flush')
        .send(
          invalidationPatternDtoBuilder()
            .with('invalidate', 'tokens')
            .with('patternDetails', { chain_id: chain.chainId })
            .build(),
        )
        .expect(200);

      // check the tokens are flushed
      await Promise.all(
        tokens.map(async (token) =>
          expect(
            await fakeCacheService.get(
              CacheRouter.getTokenCacheDir(chain.chainId, token.address),
            ),
          ).toBeUndefined(),
        ),
      );

      // check the chain and safe remain
      expect(
        await fakeCacheService.get(CacheRouter.getChainCacheDir(chain.chainId)),
      ).toBeDefined();
      expect(
        await fakeCacheService.get(
          CacheRouter.getSafeCacheDir(chain.chainId, safe.address),
        ),
      ).toBeDefined();
    });

    it('should throw an error if a bad pattern detail is provided when invalidating tokens', async () => {
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
              CacheRouter.getTokenCacheDir(chain.chainId, token.address),
            ),
          ).toBeDefined(),
        ),
      );

      // execute flush
      const invalidPatternDetail = {
        [faker.random.word()]: faker.random.word(),
        [faker.random.word()]: faker.random.word(),
      };
      await request(app.getHttpServer())
        .post('/v2/flush')
        .send(
          invalidationPatternDtoBuilder()
            .with('invalidate', 'tokens')
            .with('patternDetails', invalidPatternDetail)
            .build(),
        )
        .expect(422)
        .expect({
          statusCode: 422,
          message: `Unprocessable cache invalidation pattern detail: ${JSON.stringify(
            invalidPatternDetail,
          )}`,
          error: 'Unprocessable Entity',
        });
    });
  });
});
