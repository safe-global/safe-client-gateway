import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../app.provider';
import { TestCacheModule } from '../../../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../../../domain.module';
import { chainBuilder } from '../../../../domain/chains/entities/__tests__/chain.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '../../../../domain/safe/entities/__tests__/module-transaction.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '../../../../logging/__tests__/test.logging.module';
import { ValidationModule } from '../../../../validation/validation.module';
import { TransactionsModule } from '../../transactions.module';
import { ConfigurationModule } from '../../../../config/configuration.module';
import configuration from '../../../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../../../config/configuration.service.interface';

describe('List module transactions by Safe - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        TransactionsModule,
        // common
        DomainModule,
        TestCacheModule,
        ConfigurationModule.register(configuration),
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Failure: Config API fails', async () => {
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    mockNetworkService.get.mockRejectedValueOnce({
      status: 500,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(mockNetworkService.get).toBeCalledTimes(1);
    expect(mockNetworkService.get).toBeCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
  });

  it('Failure: Transaction API fails', async () => {
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
    mockNetworkService.get.mockRejectedValueOnce({
      status: 500,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(mockNetworkService.get).toBeCalledTimes(2);
    expect(mockNetworkService.get).toBeCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
  });

  it('Get module transaction should return 404', async () => {
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
    mockNetworkService.get.mockResolvedValueOnce({ data: { results: [] } });
    mockNetworkService.get.mockRejectedValueOnce({
      status: 404,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });

    expect(mockNetworkService.get).toBeCalledTimes(3);
    expect(mockNetworkService.get).toBeCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
  });

  it('Get module transaction successfully', async () => {
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    const moduleTransaction = {
      count: 2,
      next: null,
      previous: null,
      results: [
        moduleTransactionToJson(moduleTransactionBuilder().build()),
        moduleTransactionToJson(moduleTransactionBuilder().build()),
      ],
    };

    const safe = safeBuilder().build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
    mockNetworkService.get.mockResolvedValueOnce({ data: moduleTransaction });
    mockNetworkService.get.mockResolvedValueOnce({ data: safe });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(200);
  });
});
