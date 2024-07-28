import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/datasources/accounts/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import jwtConfiguration from '@/datasources/jwt/configuration/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { counterfactualSafeBuilder } from '@/domain/accounts/counterfactual-safes/entities/__tests__/counterfactual-safe.builder';
import { accountDataSettingBuilder } from '@/domain/accounts/entities/__tests__/account-data-setting.builder';
import { accountDataTypeBuilder } from '@/domain/accounts/entities/__tests__/account-data-type.builder';
import { accountBuilder } from '@/domain/accounts/entities/__tests__/account.builder';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { getAddress } from 'viem';

describe('CounterfactualSafesController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let accountsRepository: jest.MockedObjectDeep<IAccountsRepository>;
  let counterfactualSafesDataSource: jest.MockedObjectDeep<ICounterfactualSafesDatasource>;

  beforeAll(async () => {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        accounts: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(AccountsDatasourceModule)
      .useModule(TestAccountsDataSourceModule)
      .overrideModule(CounterfactualSafesDatasourceModule)
      .useModule(TestCounterfactualSafesDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();
    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    accountsRepository = moduleFixture.get(IAccountsDatasource);
    counterfactualSafesDataSource = moduleFixture.get(
      ICounterfactualSafesDatasource,
    );

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Get Counterfactual Safe', () => {
    it('should return a Counterfactual Safe', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', 'CounterfactualSafes')
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafe.mockResolvedValue(
        counterfactualSafe,
      );

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/storage/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({
          chainId: counterfactualSafe.chain_id,
          creator: counterfactualSafe.creator,
          fallbackHandler: counterfactualSafe.fallback_handler,
          owners: counterfactualSafe.owners,
          predictedAddress: counterfactualSafe.predicted_address,
          saltNonce: counterfactualSafe.salt_nonce,
          singletonAddress: counterfactualSafe.singleton_address,
          threshold: counterfactualSafe.threshold,
          accountId: counterfactualSafe.account_id.toString(),
        });
    });
  });
});
