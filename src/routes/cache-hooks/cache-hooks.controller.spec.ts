import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestCacheModule } from '../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { ValidationModule } from '../../validation/validation.module';
import { TestLoggingModule } from '../../logging/__tests__/test.logging.module';
import { CacheHooksModule } from './cache-hooks.module';
import { ConfigurationModule } from '../../config/configuration.module';
import configuration from '../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { CacheDir } from '../../datasources/cache/entities/cache-dir.entity';
import { FakeCacheService } from '../../datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '../../datasources/cache/cache.service.interface';

describe('Post Hook Events (Unit)', () => {
  let app: INestApplication;
  let authToken;
  let safeConfigUrl;
  let fakeCacheService: FakeCacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        CacheHooksModule,
        // common
        DomainModule,
        TestCacheModule,
        ConfigurationModule.register(configuration),
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();

    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    const configurationService = moduleFixture.get(IConfigurationService);
    authToken = configurationService.get('auth.token');
    safeConfigUrl = configurationService.get('safeConfig.baseUri');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw an error if authorization is not sent in the request headers', async () => {
    await request(app.getHttpServer())
      .post(`/chains/1/hooks/events`)
      .send({})
      .expect(403);
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
        case `${safeConfigUrl}/api/v1/chains/1`:
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

  it('accepts INCOMING_ETHER', async () => {
    const chainId = faker.random.numeric();
    const data = {
      address: faker.finance.ethereumAddress(),
      chainId: chainId,
      type: 'INCOMING_ETHER',
      txHash: faker.datatype.hexadecimal(32),
      value: faker.random.numeric(),
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);
  });

  it('accepts INCOMING_TOKEN', async () => {
    const chainId = faker.random.numeric();
    const data = {
      address: faker.finance.ethereumAddress(),
      chainId: chainId,
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);
  });

  it('accepts OUTGOING_ETHER', async () => {
    const chainId = faker.random.numeric();
    const data = {
      address: faker.finance.ethereumAddress(),
      chainId: chainId,
      type: 'OUTGOING_ETHER',
      txHash: faker.datatype.hexadecimal(32),
      value: faker.random.numeric(),
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);
  });

  it('accepts OUTGOING_TOKEN', async () => {
    const chainId = faker.random.numeric();
    const data = {
      address: faker.finance.ethereumAddress(),
      chainId: chainId,
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
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
        case `${safeConfigUrl}/api/v1/chains/1`:
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

  it('accepts PENDING_MULTISIG_TRANSACTION', async () => {
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
        case `${safeConfigUrl}/api/v1/chains/1`:
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
        case `${safeConfigUrl}/api/v1/chains/1`:
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

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.datatype.hexadecimal(32),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'OUTGOING_ETHER',
      txHash: faker.datatype.hexadecimal(32),
      value: faker.random.numeric(),
    },
    {
      type: 'INCOMING_ETHER',
      txHash: faker.datatype.hexadecimal(32),
      value: faker.random.numeric(),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    },
  ])('$type clears balances', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.random.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_balances_${safeAddress}`,
      faker.random.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.random.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      safeTxHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.datatype.hexadecimal(32),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'NEW_CONFIRMATION',
      owner: faker.finance.ethereumAddress(),
      safeTxHash: faker.datatype.hexadecimal(32),
    },
  ])('$type clears multisig transactions', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.random.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_multisig_transactions_${safeAddress}`,
      faker.random.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.random.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      safeTxHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.datatype.hexadecimal(32),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'NEW_CONFIRMATION',
      owner: faker.finance.ethereumAddress(),
      safeTxHash: faker.datatype.hexadecimal(32),
    },
  ])('$type clears multisig transaction', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.random.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_multisig_transaction_${payload.safeTxHash}`,
      faker.random.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.random.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.datatype.hexadecimal(32),
      txHash: faker.datatype.hexadecimal(32),
    },
  ])('$type clears safe info', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.random.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_safe_${safeAddress}`,
      faker.random.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.random.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.datatype.hexadecimal(32),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    },
  ])('$type clears safe collectibles', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.random.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_collectibles_${safeAddress}`,
      faker.random.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.random.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.datatype.hexadecimal(32),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    },
  ])('$type clears safe collectible transfers', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.random.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_transfers_${safeAddress}`,
      faker.random.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.random.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.hexadecimal(32),
    },
    {
      type: 'INCOMING_ETHER',
      txHash: faker.datatype.hexadecimal(32),
      value: faker.random.numeric(),
    },
  ])('$type clears incoming transfers', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.random.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_incoming_transfers_${safeAddress}`,
      faker.random.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.random.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(200);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });
});
