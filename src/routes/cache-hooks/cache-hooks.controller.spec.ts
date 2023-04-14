import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
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
import { ValidationModule } from '../../validation/validation.module';
import { CacheHooksModule } from './cache-hooks.module';

describe('Post Hook Events (Unit)', () => {
  let app: INestApplication;
  const authToken = faker.datatype.uuid();

  beforeAll(async () => {
    fakeConfigurationService.set('exchange.baseUri', 'https://test.exchange');
    fakeConfigurationService.set('exchange.apiKey', 'testKey');
    fakeConfigurationService.set(
      'safeConfig.baseUri',
      'https://test.safe.config',
    );
    fakeConfigurationService.set('auth.token', authToken);
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
    it('should throw an error if authorization is not sent in the request headers', async () => {
      await request(app.getHttpServer())
        .post(`/chains/1/hooks/events`)
        .send({})
        .expect(401);
    });

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
        .set('Authorization', `Basic ${authToken}`)
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
        .set('Authorization', `Basic ${authToken}`)
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
        .set('Authorization', `Basic ${authToken}`)
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
        .set('Authorization', `Basic ${authToken}`)
        .send(data)
        .expect(400);
    });
  });

  describe('on EXECUTED_MULTISIG_TRANSACTION', () => {
    it('clears local balances', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = '1';
      const cacheDir = new CacheDir(
        `${chainId}_${safeAddress}_balances`,
        faker.random.alpha(),
      );
      await fakeCacheService.set(cacheDir, faker.random.alpha());
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
        .set('Authorization', `Basic ${authToken}`)
        .send(data)
        .expect(200);

      await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
    });
  });
});
