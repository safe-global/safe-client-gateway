import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { valkBalanceBuilder } from '@/datasources/balances-api/entities/__tests__/valk-balance.entity.builder';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import {
  zerionAttributesBuilder,
  zerionFungibleInfoBuilder,
  zerionImplementationBuilder,
  zerionQuantityBuilder,
  zerionBalanceBuilder,
  zerionFlagsBuilder,
} from '@/datasources/balances-api/entities/__tests__/zerion-balance.entity.builder';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let valkBaseUri: string;
  let zerionBaseUri: string;

  beforeEach(async () => {
    jest.clearAllMocks();

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
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    valkBaseUri = configurationService.get('balances.providers.valk.baseUri');
    zerionBaseUri = configurationService.get(
      'balances.providers.zerion.baseUri',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Balances provider: Valk', () => {
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
              return Promise.resolve({ data: chain, status: 200 });
            case `${valkBaseUri}/balances/token/${safeAddress}?chain=${chainName}`:
              return Promise.resolve({
                data: valkApiBalancesResponse,
                status: 200,
              });
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
              return Promise.resolve({ data: chain, status: 200 });
            case `${valkBaseUri}/balances/token/${safeAddress}?chain=${chainName}`:
              return Promise.resolve({
                data: valkApiBalancesResponse,
                status: 200,
              });
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

    describe('Config API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '100';
        const safeAddress = faker.finance.ethereumAddress();
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(`balances.providers.valk.chains.${chainId}.chainName`);
        const error = new NetworkResponseError(
          new URL(
            `${safeConfigUrl}/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`,
          ),
          {
            status: 500,
          } as Response,
        );
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.reject(error);
            case `${valkBaseUri}/balances/token/${safeAddress}?chain=${chainName}`:
              return Promise.resolve({ data: [], status: 200 });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'An error occurred',
            code: 500,
          });
      });
    });

    describe('Valk Balances API Error', () => {
      it(`500 error response`, async () => {
        const chain = chainBuilder().with('chainId', '100').build();
        const safeAddress = faker.finance.ethereumAddress();
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(
            `balances.providers.valk.chains.${chain.chainId}.chainName`,
          );
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${valkBaseUri}/balances/token/${safeAddress}?chain=${chainName}`:
              return Promise.reject(new Error('test error'));
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/usd`)
          .expect(503)
          .expect({
            message: `Error getting ${safeAddress} balances from provider: test error}`,
            code: 503,
          });
      });
    });
  });

  describe('Balances provider: Zerion', () => {
    describe('GET /balances (externalized)', () => {
      it(`maps native coin + ERC20 token balance correctly, and sorts balances by fiatBalance`, async () => {
        const chain = chainBuilder().with('chainId', '1101').build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = faker.finance.currencyCode();
        const implementationAddress = faker.finance.ethereumAddress();
        const testTokenIconUrl = faker.internet.url();
        const etherIconUrl = faker.internet.url();
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(
            `balances.providers.zerion.chains.${chain.chainId}.chainName`,
          );
        const zerionApiBalancesResponse = [
          zerionBalanceBuilder()
            .with(
              'attributes',
              zerionAttributesBuilder()
                .with(
                  'quantity',
                  zerionQuantityBuilder()
                    .with('int', '12000000000000000')
                    .with('decimals', 15)
                    .build(),
                )
                .with('value', 27)
                .with('price', 1.5)
                .with(
                  'fungible_info',
                  zerionFungibleInfoBuilder()
                    .with('name', 'Test Token')
                    .with('symbol', 'TST')
                    .with('icon', { url: testTokenIconUrl })
                    .with('implementations', [
                      zerionImplementationBuilder()
                        .with('address', implementationAddress)
                        .with('chain_id', chainName)
                        .build(),
                      zerionImplementationBuilder()
                        .with('address', faker.finance.ethereumAddress())
                        .with('chain_id', 'avalanche')
                        .build(),
                    ])
                    .build(),
                )
                .with(
                  'flags',
                  zerionFlagsBuilder().with('displayable', true).build(),
                )
                .build(),
            )
            .build(),
          zerionBalanceBuilder()
            .with(
              'attributes',
              zerionAttributesBuilder()
                .with(
                  'quantity',
                  zerionQuantityBuilder()
                    .with('int', '25000000000000000')
                    .with('decimals', 18)
                    .build(),
                )
                .with('value', 38.085)
                .with('price', 1523.4)
                .with(
                  'fungible_info',
                  zerionFungibleInfoBuilder()
                    .with('name', 'Ethereum')
                    .with('symbol', 'ETH')
                    .with('icon', { url: etherIconUrl })
                    .with('implementations', [
                      zerionImplementationBuilder()
                        .with('address', null)
                        .with('chain_id', chainName)
                        .build(),
                      zerionImplementationBuilder()
                        .with('address', faker.finance.ethereumAddress())
                        .with('chain_id', 'avalanche')
                        .build(),
                      zerionImplementationBuilder()
                        .with('address', faker.finance.ethereumAddress())
                        .with('chain_id', 'xdai')
                        .build(),
                    ])
                    .build(),
                )
                .with(
                  'flags',
                  zerionFlagsBuilder().with('displayable', true).build(),
                )
                .build(),
            )
            .build(),
        ];
        const apiKey = app
          .get(IConfigurationService)
          .getOrThrow(`balances.providers.zerion.apiKey`);
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions?filter[chain_ids]=${chainName}&currency=${currency.toLowerCase()}&sort=value`:
              return Promise.resolve({
                data: zerionApiBalancesResponse,
                status: 200,
              });
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
              fiatTotal: '65.085',
              items: [
                {
                  tokenInfo: {
                    type: 'NATIVE_TOKEN',
                    address: NULL_ADDRESS,
                    decimals: chain.nativeCurrency.decimals,
                    symbol: chain.nativeCurrency.symbol,
                    name: chain.nativeCurrency.name,
                    logoUri: chain.nativeCurrency.logoUri,
                  },
                  balance: '25000000000000000',
                  fiatBalance: '38.085',
                  fiatConversion: '1523.4',
                },
                {
                  tokenInfo: {
                    type: 'ERC20',
                    address: implementationAddress,
                    decimals: 15,
                    symbol: 'TST',
                    name: 'Test Token',
                    logoUri: testTokenIconUrl,
                  },
                  balance: '12000000000000000',
                  fiatBalance: '27',
                  fiatConversion: '1.5',
                },
              ],
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/positions?filter[chain_ids]=${chainName}&currency=${currency.toLowerCase()}&sort=value`,
        );
        expect(networkService.get.mock.calls[0][1]).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
        });
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
      });

      it.todo('returns large numbers as is (not in scientific notation)');
    });

    describe('Config API Error', () => {
      it.todo(`500 error response`);
    });

    describe('Zerion Balances API Error', () => {
      it.todo(`500 error response`);
    });
  });
});
