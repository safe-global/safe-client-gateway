import { Test, TestingModule } from '@nestjs/testing';
import { AppModule, configurationModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import * as request from 'supertest';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { ConfigurationModule } from '@/config/configuration.module';

describe('Safes Controller Nonces (Unit)', () => {
  describe('Nonces Route is enabled', () => {
    let app: INestApplication;
    let safeConfigUrl;
    let networkService;
    let configurationService;

    beforeEach(async () => {
      jest.clearAllMocks();

      const defaultConfiguration = configuration();
      const testConfiguration = () => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          noncesRoute: true,
        },
      });

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideModule(CacheModule)
        .useModule(TestCacheModule)
        .overrideModule(configurationModule)
        .useModule(ConfigurationModule.register(testConfiguration))
        .overrideModule(RequestScopedLoggingModule)
        .useModule(TestLoggingModule)
        .overrideModule(NetworkModule)
        .useModule(TestNetworkModule)
        .compile();

      configurationService = moduleFixture.get(IConfigurationService);
      safeConfigUrl = configurationService.get('safeConfig.baseUri');
      networkService = moduleFixture.get(NetworkService);

      app = await new TestAppProvider().provide(moduleFixture);
      await app.init();
    });

    it('returns latest transaction nonce + 1 if greater than safe nonce', async () => {
      const chain = chainBuilder().build();
      const safeInfo = safeBuilder().with('nonce', 5).build();
      const multisigTransactions = [
        multisigTransactionBuilder().with('nonce', 6).build(),
      ];
      const multisigTransactionsPage = pageBuilder()
        .with(
          'results',
          multisigTransactions.map((tx) => multisigTransactionToJson(tx)),
        )
        .build();

      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
            return Promise.resolve({ data: safeInfo });
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
            return Promise.resolve({ data: multisigTransactionsPage });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}/nonces`)
        .expect(200)
        .expect({
          currentNonce: safeInfo.nonce,
          recommendedNonce: multisigTransactions[0].nonce + 1,
        });
    });

    it('returns safe nonce if greater than latest transaction', async () => {
      const chain = chainBuilder().build();
      const safeInfo = safeBuilder().with('nonce', 10).build();
      const multisigTransactions = [
        multisigTransactionBuilder().with('nonce', 6).build(),
      ];
      const multisigTransactionsPage = pageBuilder()
        .with(
          'results',
          multisigTransactions.map((tx) => multisigTransactionToJson(tx)),
        )
        .build();

      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
            return Promise.resolve({ data: safeInfo });
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
            return Promise.resolve({ data: multisigTransactionsPage });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}/nonces`)
        .expect(200)
        .expect({
          currentNonce: safeInfo.nonce,
          recommendedNonce: safeInfo.nonce,
        });
    });

    it('returns safe nonce if there are no transactions', async () => {
      const chain = chainBuilder().build();
      const safeInfo = safeBuilder().build();
      const multisigTransactionsPage = pageBuilder()
        .with('results', [])
        .build();

      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
            return Promise.resolve({ data: safeInfo });
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
            return Promise.resolve({ data: multisigTransactionsPage });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}/nonces`)
        .expect(200)
        .expect({
          currentNonce: safeInfo.nonce,
          recommendedNonce: safeInfo.nonce,
        });
    });
  });

  describe('Nonces Route is disabled', () => {
    let app: INestApplication;

    beforeEach(async () => {
      jest.clearAllMocks();

      const defaultConfiguration = configuration();
      const testConfiguration = () => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          noncesRoute: false,
        },
      });

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideModule(CacheModule)
        .useModule(TestCacheModule)
        .overrideModule(configurationModule)
        .useModule(ConfigurationModule.register(testConfiguration))
        .overrideModule(RequestScopedLoggingModule)
        .useModule(TestLoggingModule)
        .overrideModule(NetworkModule)
        .useModule(TestNetworkModule)
        .compile();

      app = await new TestAppProvider().provide(moduleFixture);
      await app.init();
    });

    it('returns 403', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/safes/${safeAddress}/nonces`)
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });
  });
});
