import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { faker } from '@faker-js/faker';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { EmailDataSourceModule } from '@/datasources/email/email.datasource.module';
import { TestEmailDatasourceModule } from '@/datasources/email/__tests__/test.email.datasource.module';
import { valkBalanceBuilder } from '@/datasources/balances-api/entities/__tests__/valk-balance.entity.builder';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let networkService;
  let valkBaseUri;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(EmailDataSourceModule)
      .useModule(TestEmailDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    valkBaseUri = configurationService.get('balances.providers.valk.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances (externalized)', () => {
    it(`maps native coin + ERC20 token balance correctly, and sorts balances by fiatBalance`, async () => {
      const chain = chainBuilder().with('chainId', '100').build();
      const safeAddress = faker.finance.ethereumAddress();
      const currency = faker.finance.currencyCode();
      const valkApiBalancesResponse = [
        valkBalanceBuilder()
          .with('token_address', 'eth')
          .with('balance', 1 * Math.pow(10, 18))
          .with('decimals', 18)
          .with('prices', { [currency]: 1 })
          .build(),
        valkBalanceBuilder()
          .with('balance', 1.5 * Math.pow(10, 17))
          .with('decimals', 17)
          .with('prices', { [currency]: 3 })
          .build(),
        valkBalanceBuilder()
          .with('balance', 3 * Math.pow(10, 17))
          .with('decimals', 17)
          .with('prices', { [currency]: 2.0 })
          .build(),
      ];
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.valk.chains.${chain.chainId}.chainName`,
        );
      const apiKey = app
        .get(IConfigurationService)
        .getOrThrow(`balances.providers.valk.apiKey`);
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${valkBaseUri}/balances/token/${safeAddress}?chain=${chainName}`:
            return Promise.resolve({ data: valkApiBalancesResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${
            chain.chainId
          }/safes/${safeAddress}/balances/${currency.toUpperCase()}`,
        )
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            fiatTotal: '11.5',
            items: [
              {
                tokenInfo: {
                  type: 'ERC20',
                  address: valkApiBalancesResponse[2].token_address,
                  decimals: 17,
                  symbol: valkApiBalancesResponse[2].symbol,
                  name: valkApiBalancesResponse[2].name,
                  logoUri: valkApiBalancesResponse[2].logo,
                },
                balance: '300000000000000000',
                fiatBalance: '6',
                fiatConversion: '2',
              },
              {
                tokenInfo: {
                  type: 'ERC20',
                  address: valkApiBalancesResponse[1].token_address,
                  decimals: 17,
                  symbol: valkApiBalancesResponse[1].symbol,
                  name: valkApiBalancesResponse[1].name,
                  logoUri: valkApiBalancesResponse[1].logo,
                },
                balance: '150000000000000000',
                fiatBalance: '4.5',
                fiatConversion: '3',
              },
              {
                tokenInfo: {
                  type: 'NATIVE_TOKEN',
                  address: NULL_ADDRESS,
                  decimals: chain.nativeCurrency.decimals,
                  symbol: chain.nativeCurrency.symbol,
                  name: chain.nativeCurrency.name,
                  logoUri: chain.nativeCurrency.logoUri,
                },
                balance: '1000000000000000000',
                fiatBalance: '1',
                fiatConversion: '1',
              },
            ],
          });
        });

      expect(networkService.get.mock.calls.length).toBe(2);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${valkBaseUri}/balances/token/${safeAddress}?chain=${chainName}`,
      );
      expect(networkService.get.mock.calls[0][1]).toStrictEqual({
        headers: { Authorization: apiKey },
      });
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
    });

    it('returns large numbers as is (not in scientific notation)', async () => {
      const chain = chainBuilder().with('chainId', '100').build();
      const safeAddress = faker.finance.ethereumAddress();
      const currency = faker.finance.currencyCode();
      const valkApiBalancesResponse = [
        valkBalanceBuilder()
          .with('balance', 3 * Math.pow(10, 20))
          .with('decimals', 5)
          .with('prices', { [currency]: 2 })
          .build(),
      ];
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.valk.chains.${chain.chainId}.chainName`,
        );
      const apiKey = app
        .get(IConfigurationService)
        .getOrThrow(`balances.providers.valk.apiKey`);
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${valkBaseUri}/balances/token/${safeAddress}?chain=${chainName}`:
            return Promise.resolve({ data: valkApiBalancesResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${
            chain.chainId
          }/safes/${safeAddress}/balances/${currency.toUpperCase()}`,
        )
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            fiatTotal: '6000000000000000',
            items: [
              {
                tokenInfo: {
                  type: 'ERC20',
                  address: valkApiBalancesResponse[0].token_address,
                  decimals: 5,
                  symbol: valkApiBalancesResponse[0].symbol,
                  name: valkApiBalancesResponse[0].name,
                  logoUri: valkApiBalancesResponse[0].logo,
                },
                balance: '300000000000000000000',
                fiatBalance: '6000000000000000',
                fiatConversion: '2',
              },
            ],
          });
        });

      expect(networkService.get.mock.calls.length).toBe(2);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${valkBaseUri}/balances/token/${safeAddress}?chain=${chainName}`,
      );
      expect(networkService.get.mock.calls[0][1]).toStrictEqual({
        headers: { Authorization: apiKey },
      });
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
    });
  });
});
