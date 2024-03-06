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
  zerionBalancesBuilder,
} from '@/datasources/balances-api/entities/__tests__/zerion-balance.entity.builder';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let zerionBaseUri: string;
  let zerionChainIds: string[];
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      balances: {
        ...defaultConfiguration.balances,
        providers: {
          ...defaultConfiguration.balances.providers,
          zerion: {
            ...defaultConfiguration.balances.providers.zerion,
            limitCalls: 5,
            limitPeriodSeconds: 2,
          },
        },
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
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

    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    zerionBaseUri = configurationService.getOrThrow(
      'balances.providers.zerion.baseUri',
    );
    zerionChainIds = configurationService.getOrThrow(
      'features.zerionBalancesChainIds',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Balances provider: Zerion', () => {
    describe('GET /balances (externalized)', () => {
      it(`maps native coin + ERC20 token balance correctly, and sorts balances by fiatBalance`, async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = faker.finance.currencyCode();
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(
            `balances.providers.zerion.chains.${chain.chainId}.chainName`,
          );
        const nativeCoinFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().build(),
            zerionImplementationBuilder()
              .with('address', null)
              .with('chain_id', chainName)
              .build(),
          ])
          .build();
        const erc20TokenFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().with('chain_id', chainName).build(),
            zerionImplementationBuilder().build(),
          ])
          .build();
        const zerionApiBalancesResponse = zerionBalancesBuilder()
          .with('data', [
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
                  .with('value', 20.002)
                  .with('price', 10.1)
                  .with('fungible_info', erc20TokenFungibleInfo)
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
                      .build(),
                  )
                  .with('value', 100.001)
                  .with('price', 5.05)
                  .with('fungible_info', nativeCoinFungibleInfo)
                  .with(
                    'flags',
                    zerionFlagsBuilder().with('displayable', true).build(),
                  )
                  .build(),
              )
              .build(),
          ])
          .build();
        const apiKey = app
          .get(IConfigurationService)
          .getOrThrow(`balances.providers.zerion.apiKey`);
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
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
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(200)
          .expect(({ body }) => {
            expect(body).toEqual({
              fiatTotal: '120.003',
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
                  fiatBalance: '100.001',
                  fiatConversion: '5.05',
                },
                {
                  tokenInfo: {
                    type: 'ERC20',
                    address: erc20TokenFungibleInfo.implementations[0].address,
                    decimals: 15,
                    symbol: erc20TokenFungibleInfo.symbol,
                    name: erc20TokenFungibleInfo.name,
                    logoUri: erc20TokenFungibleInfo.icon?.url,
                  },
                  balance: '12000000000000000',
                  fiatBalance: '20.002',
                  fiatConversion: '10.1',
                },
              ],
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        );
        expect(networkService.get.mock.calls[0][1]).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            currency: currency.toLowerCase(),
            sort: 'value',
          },
        });
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
      });

      it('returns large numbers as is (not in scientific notation)', async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = faker.finance.currencyCode();
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(
            `balances.providers.zerion.chains.${chain.chainId}.chainName`,
          );
        const nativeCoinFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().build(),
            zerionImplementationBuilder()
              .with('address', null)
              .with('chain_id', chainName)
              .build(),
          ])
          .build();
        const erc20TokenFungibleInfo = zerionFungibleInfoBuilder()
          .with('icon', null)
          .with('implementations', [
            zerionImplementationBuilder().with('chain_id', chainName).build(),
            zerionImplementationBuilder().build(),
          ])
          .build();
        const zerionApiBalancesResponse = zerionBalancesBuilder()
          .with('data', [
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
                  .with('value', 20000000000000000)
                  .with('price', 10.1)
                  .with('fungible_info', erc20TokenFungibleInfo)
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
                      .build(),
                  )
                  .with('value', 100000000000000000)
                  .with('price', 5.05)
                  .with('fungible_info', nativeCoinFungibleInfo)
                  .with(
                    'flags',
                    zerionFlagsBuilder().with('displayable', true).build(),
                  )
                  .build(),
              )
              .build(),
          ])
          .build();
        const apiKey = app
          .get(IConfigurationService)
          .getOrThrow(`balances.providers.zerion.apiKey`);
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
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
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(200)
          .expect(({ body }) => {
            expect(body).toEqual({
              fiatTotal: '120000000000000000',
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
                  fiatBalance: '100000000000000000',
                  fiatConversion: '5.05',
                },
                {
                  tokenInfo: {
                    type: 'ERC20',
                    address: erc20TokenFungibleInfo.implementations[0].address,
                    decimals: 15,
                    symbol: erc20TokenFungibleInfo.symbol,
                    name: erc20TokenFungibleInfo.name,
                    logoUri: '',
                  },
                  balance: '12000000000000000',
                  fiatBalance: '20000000000000000',
                  fiatConversion: '10.1',
                },
              ],
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        );
        expect(networkService.get.mock.calls[0][1]).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            currency: currency.toLowerCase(),
            sort: 'value',
          },
        });
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
      });
    });

    describe('Config API Error', () => {
      it(`500 error response`, async () => {
        const chainId = zerionChainIds[0];
        const safeAddress = faker.finance.ethereumAddress();
        const currency = faker.finance.currencyCode();
        const error = new NetworkResponseError(
          new URL(
            `${safeConfigUrl}/v1/chains/${chainId}/safes/${safeAddress}/balances/${currency}`,
          ),
          {
            status: 500,
          } as Response,
        );
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.reject(error);
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.resolve({
                data: zerionBalancesBuilder().with('data', []).build(),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(500)
          .expect({
            message: 'An error occurred',
            code: 500,
          });
      });
    });

    describe('Zerion Balances API Error', () => {
      it(`500 error response`, async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = faker.finance.currencyCode();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.reject(new Error('test error'));
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(503)
          .expect({
            code: 503,
            message: 'Service unavailable',
          });
      });
    });

    describe('Rate Limit error', () => {
      it('does not trigger a rate-limit error', async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = faker.finance.currencyCode();
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(
            `balances.providers.zerion.chains.${chain.chainId}.chainName`,
          );
        const nativeCoinFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder()
              .with('address', null)
              .with('chain_id', chainName)
              .build(),
          ])
          .build();
        const erc20TokenFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().with('chain_id', chainName).build(),
          ])
          .build();
        const zerionApiBalancesResponse = zerionBalancesBuilder()
          .with('data', [
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with('fungible_info', erc20TokenFungibleInfo)
                  .build(),
              )
              .build(),
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with('fungible_info', nativeCoinFungibleInfo)
                  .build(),
              )
              .build(),
          ])
          .build();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
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
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(200)
          .expect(({ body }) => {
            expect(body).toEqual({
              fiatTotal: expect.any(String),
              items: expect.any(Array),
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
      });

      it('triggers a rate-limit error', async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = faker.finance.ethereumAddress();
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(
            `balances.providers.zerion.chains.${chain.chainId}.chainName`,
          );
        const nativeCoinFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder()
              .with('address', null)
              .with('chain_id', chainName)
              .build(),
          ])
          .build();
        const erc20TokenFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().with('chain_id', chainName).build(),
          ])
          .build();
        const zerionApiBalancesResponse = zerionBalancesBuilder()
          .with('data', [
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with('fungible_info', erc20TokenFungibleInfo)
                  .build(),
              )
              .build(),
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with('fungible_info', nativeCoinFungibleInfo)
                  .build(),
              )
              .build(),
          ])
          .build();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.resolve({
                data: zerionApiBalancesResponse,
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        const limitCalls = configurationService.getOrThrow<number>(
          'balances.providers.zerion.limitCalls',
        );
        for (let i = 0; i < limitCalls; i++) {
          await request(app.getHttpServer())
            .get(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${crypto.randomUUID()}`,
            )
            .expect(200);
        }

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${crypto.randomUUID()}`,
          )
          .expect(429);

        // Calls expected: 'limitCalls' calls to Zerion + 1 call to ConfigApi
        expect(networkService.get.mock.calls.length).toBe(limitCalls + 1);
      });
    });
  });
});
