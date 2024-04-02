import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { DeleteTransactionDto } from '@/routes/transactions/entities/delete-transaction.dto.entity';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { TestQueueConsumerModule } from '@/datasources/queues/__tests__/test.queue-consumer.module';
import { QueueConsumerModule } from '@/datasources/queues/queue-consumer.module';

describe('Delete Transaction - Transactions Controller (Unit', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let fakeCacheService: FakeCacheService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueueConsumerModule)
      .useModule(TestQueueConsumerModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);
    fakeCacheService = moduleFixture.get(CacheService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw a validation error', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 16 });
    const invalidDeleteTransactionDto = {
      signature: faker.number.int(),
    };

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chainId}/transactions/${safeTxHash}`)
      .send(invalidDeleteTransactionDto)
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['signature'],
        message: 'Expected string, received number',
      });
  });

  it('should delete a multisig transaction', async () => {
    const chain = chainBuilder().build();
    const tx = multisigTransactionBuilder().build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`
      ) {
        return Promise.resolve({ data: multisigToJson(tx), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.delete.mockImplementation(({ url }) => {
      if (
        url ===
        `${chain.transactionService}/api/v1/transactions/${tx.safeTxHash}`
      ) {
        return Promise.resolve({ data: {}, status: 204 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(200);
  });

  it('should clear the cache after deleting a multisig transaction', async () => {
    const chain = chainBuilder().build();
    const tx = multisigTransactionBuilder().build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`
      ) {
        return Promise.resolve({ data: multisigToJson(tx), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.delete.mockImplementation(({ url }) => {
      if (
        url ===
        `${chain.transactionService}/api/v1/transactions/${tx.safeTxHash}`
      ) {
        return Promise.resolve({ data: {}, status: 204 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(200);

    await expect(
      fakeCacheService.get(
        new CacheDir(
          `${chain.chainId}_multisig_transaction_${tx.safeTxHash}`,
          '',
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      fakeCacheService.get(
        new CacheDir(`${chain.chainId}_multisig_transactions_${tx.safe}`, ''),
      ),
    ).resolves.toBeUndefined();
  });

  it('should forward an error from the Transaction Service', async () => {
    const chain = chainBuilder().build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    const tx = multisigTransactionBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`
      ) {
        return Promise.resolve({ data: multisigToJson(tx), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.delete.mockImplementation(({ url }) => {
      if (
        url ===
        `${chain.transactionService}/api/v1/transactions/${tx.safeTxHash}`
      ) {
        return Promise.reject(
          new NetworkResponseError(
            new URL(safeConfigUrl),
            {
              status: 404,
            } as Response,
            { message: 'Transaction not found', status: 404 },
          ),
        );
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(404)
      .expect({
        message: 'Transaction not found',
        code: 404,
      });
  });
});
