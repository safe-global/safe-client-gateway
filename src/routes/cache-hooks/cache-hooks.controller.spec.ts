import { INestApplication } from '@nestjs/common';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainModule } from '../../domain.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { CacheHooksModule } from './cache-hooks.module';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { ValidationModule } from '../../validation.module';

describe('Post Hook Events (Unit)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    fakeConfigurationService.set('exchange.baseUri', 'https://test.exchange');
    fakeConfigurationService.set('exchange.apiKey', 'testKey');
    fakeConfigurationService.set(
      'safeConfig.baseUri',
      'https://test.safe.config',
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        CacheHooksModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Accepts payloads', () => {
    it('accepts ExecutedTransaction', async () => {
      const chainId = '1';
      const data = {
        address: faker.finance.ethereumAddress(),
        chainId: chainId,
        type: 'EXECUTED_MULTISIG_TRANSACTION',
        safeTxHash: 'some-safe-tx-hash',
        txHash: 'some-tx-hash',
      };
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case 'https://test.safe.config/api/v1/chains/1':
            return Promise.resolve({
              data: chainBuilder().with('chainId', chainId).build(),
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(`/chains/1/hooks/events`)
        .send(data)
        .expect(200);
    });

    it('accepts NewConfirmation', async () => {
      const chainId = '1';
      const safeAddress = faker.finance.ethereumAddress();
      const data = {
        address: safeAddress,
        chainId: chainId,
        type: 'NEW_CONFIRMATION',
        owner: faker.finance.ethereumAddress(),
        safeTxHash: 'some-safe-tx-hash',
      };
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case 'https://test.safe.config/api/v1/chains/1':
            return Promise.resolve({
              data: chainBuilder().with('chainId', chainId).build(),
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(`/chains/1/hooks/events`)
        .send(data)
        .expect(200);
    });

    it('accepts PendingTransaction', async () => {
      const chainId = '1';
      const safeAddress = faker.finance.ethereumAddress();
      const data = {
        address: safeAddress,
        chainId: chainId,
        type: 'PENDING_MULTISIG_TRANSACTION',
        safeTxHash: 'some-safe-tx-hash',
      };
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case 'https://test.safe.config/api/v1/chains/1':
            return Promise.resolve({
              data: chainBuilder().with('chainId', chainId).build(),
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(`/chains/1/hooks/events`)
        .send(data)
        .expect(200);
    });

    it('returns 400 (Bad Request) on unknown payload', async () => {
      const data = {
        type: 'SOME_TEST_TYPE_THAT_WE_DO_NOT_SUPPORT',
        safeTxHash: 'some-safe-tx-hash',
      };
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case 'https://test.safe.config/api/v1/chains/1':
            return Promise.resolve({
              data: chainBuilder().with('chainId', '1').build(),
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(`/chains/1/hooks/events`)
        .send(data)
        .expect(400);
    });
  });

  describe('on EXECUTED_MULTISIG_TRANSACTION', () => {
    it('clears local balances', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = '1';
      const cacheKey = `${chainId}_${safeAddress}_balances`;
      const cacheField = faker.random.alpha();
      await fakeCacheService.set(cacheKey, cacheField, faker.random.alpha());
      const data = {
        address: safeAddress,
        chainId: chainId,
        type: 'EXECUTED_MULTISIG_TRANSACTION',
        safeTxHash: 'some-safe-tx-hash',
        txHash: 'some-tx-hash',
      };
      mockNetworkService.get.mockImplementation((url) => {
        switch (url) {
          case 'https://test.safe.config/api/v1/chains/1':
            return Promise.resolve({
              data: chainBuilder().with('chainId', chainId).build(),
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .post(`/chains/1/hooks/events`)
        .send(data)
        .expect(200);

      await expect(
        fakeCacheService.get(cacheKey, cacheField),
      ).resolves.toBeUndefined();
    });
  });
});
