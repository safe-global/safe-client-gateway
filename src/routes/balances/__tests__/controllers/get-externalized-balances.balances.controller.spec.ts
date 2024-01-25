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
          .with('balance', 4000000000000000000)
          .with('decimals', 18)
          .with('prices', { [currency]: 2.25 })
          .build(),
        valkBalanceBuilder()
          .with('balance', 4000000000000000000)
          .with('decimals', 17)
          .with('prices', { [currency]: 2.11 })
          .build(),
        valkBalanceBuilder()
          .with('balance', 6000000000000000000)
          .with('decimals', 17)
          .with('prices', { [currency]: 2.0 })
          .build(),
      ];
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.valk.chains.${chain.chainId}.chainName`,
        );
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
            fiatTotal: '213.4',
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
                balance: '6000000000000000000',
                fiatBalance: '120',
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
                balance: '4000000000000000000',
                fiatBalance: '84.4',
                fiatConversion: '2.11',
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
                balance: '4000000000000000000',
                fiatBalance: '9',
                fiatConversion: '2.25',
              },
            ],
          });
        });

      // 4 Network calls are expected
      // (1. Chain data, 2. Balances, 3. Coingecko native coin, 4. Coingecko tokens)
      // expect(networkService.get.mock.calls.length).toBe(4);
      // expect(networkService.get.mock.calls[0][0]).toBe(
      //   `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      // );
      // expect(networkService.get.mock.calls[1][0]).toBe(
      //   `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
      // );
      // expect(networkService.get.mock.calls[1][1]).toStrictEqual({
      //   params: { trusted: false, exclude_spam: true },
      // });
      // expect(networkService.get.mock.calls[2][0]).toBe(
      //   `${pricesProviderUrl}/simple/token_price/${chainName}`,
      // );
      // expect(networkService.get.mock.calls[2][1]).toStrictEqual({
      //   headers: { 'x-cg-pro-api-key': apiKey },
      //   params: {
      //     vs_currencies: currency.toLowerCase(),
      //     contract_addresses: [
      //       tokenAddress.toLowerCase(),
      //       secondTokenAddress.toLowerCase(),
      //     ].join(','),
      //   },
      // });
      // expect(networkService.get.mock.calls[3][0]).toBe(
      //   `${pricesProviderUrl}/simple/price`,
      // );
      // expect(networkService.get.mock.calls[3][1]).toStrictEqual({
      //   headers: { 'x-cg-pro-api-key': apiKey },
      //   params: { ids: nativeCoinId, vs_currencies: currency.toLowerCase() },
      // });
    });
  });
});
