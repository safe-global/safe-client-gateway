import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../__tests__/test-app.provider';
import { TestCacheModule } from '../../datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '../../datasources/network/__tests__/test.network.module';
import { balanceBuilder } from '../../domain/balances/entities/__tests__/balance.builder';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { exchangeFiatCodesBuilder } from '../../domain/exchange/entities/__tests__/exchange-fiat-codes.builder';
import { TestLoggingModule } from '../../logging/__tests__/test.logging.module';
import { NULL_ADDRESS } from '../common/constants';
import { faker } from '@faker-js/faker';
import { ConfigurationModule } from '../../config/configuration.module';
import configuration from '../../config/entities/__tests__/configuration';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { NetworkService } from '../../datasources/network/network.service.interface';
import { AppModule, configurationModule } from '../../app.module';
import { CacheModule } from '../../datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '../../logging/logging.module';
import { NetworkModule } from '../../datasources/network/network.module';
import { balanceTokenBuilder } from '../../domain/balances/entities/__tests__/balance.token.builder';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let priceProviderUrl;
  let networkService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(configurationModule)
      .useModule(ConfigurationModule.register(configuration))
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    priceProviderUrl = configurationService.get('prices.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
    it(`maps native coin + ERC20 token balance correctly`, async () => {
      const chain = chainBuilder().with('chainId', '1').build();
      const safeAddress = faker.finance.ethereumAddress();
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', tokenAddress)
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(`chains.nativeCoins.${chain.chainId}`);
      const currency = 'eur';
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId]: { [currency]: 1536.75 },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency]: 2.5 },
      };
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({ data: transactionApiBalancesResponse });
          case `${priceProviderUrl}/simple/price?ids=${nativeCoinId}&vs_currencies=${currency}`:
            return Promise.resolve({ data: nativeCoinPriceProviderResponse });
          case `${priceProviderUrl}/simple/token_price/${nativeCoinId}?contract_addresses=${tokenAddress}&vs_currencies=${currency}`:
            return Promise.resolve({ data: tokenPriceProviderResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '4710.25',
          items: [
            {
              tokenInfo: {
                type: 'ERC20',
                address: transactionApiBalancesResponse[1].tokenAddress,
                decimals: 17,
                symbol: transactionApiBalancesResponse[1].token?.symbol,
                name: transactionApiBalancesResponse[1].token?.name,
                logoUri: transactionApiBalancesResponse[1].token?.logoUri,
              },
              balance: '4000000000000000000',
              fiatBalance: '100',
              fiatConversion: '2.5',
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
              balance: '3000000000000000000',
              fiatBalance: '4610.25',
              fiatConversion: '1536.75',
            },
          ],
        });

      // 4 Network calls are expected
      // (1. Chain data, 2. Balances, 3. Coingecko native coin, 4. Coingecko token)
      expect(networkService.get.mock.calls.length).toBe(4);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
      );
      expect(networkService.get.mock.calls[1][1]).toStrictEqual({
        params: { trusted: undefined, exclude_spam: undefined },
      });
      expect(networkService.get.mock.calls[2][0]).toBe(
        `${priceProviderUrl}/simple/price?ids=${nativeCoinId}&vs_currencies=${currency}`,
      );
      expect(networkService.get.mock.calls[3][0]).toBe(
        `${priceProviderUrl}/simple/token_price/${nativeCoinId}?contract_addresses=${tokenAddress}&vs_currencies=${currency}`,
      );
    });

    it(`excludeSpam and trusted params are forwarded to tx service`, async () => {
      const chain = chainBuilder().with('chainId', '1').build();
      const safeAddress = faker.finance.ethereumAddress();
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', tokenAddress)
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const excludeSpam = true;
      const trusted = true;
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(`chains.nativeCoins.${chain.chainId}`);
      const currency = 'eur';
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency]: 2.5 },
      };
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({ data: transactionApiBalancesResponse });
          case `${priceProviderUrl}/simple/token_price/${nativeCoinId}?contract_addresses=${tokenAddress}&vs_currencies=${currency}`:
            return Promise.resolve({ data: tokenPriceProviderResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}/?trusted=${trusted}&exclude_spam=${excludeSpam}`,
        )
        .expect(200);

      // trusted and exclude_spam params are passed
      expect(networkService.get.mock.calls[1][1]).toStrictEqual({
        params: {
          trusted: trusted.toString(),
          exclude_spam: excludeSpam.toString(),
        },
      });
    });

    it(`maps native token correctly`, async () => {
      const chain = chainBuilder().with('chainId', '1').build();
      const safeAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
      ];
      const currency = 'usd';
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(`chains.nativeCoins.${chain.chainId}`);
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId]: { [currency]: 1536.75 },
      };
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({ data: transactionApiBalancesResponse });
          case `${priceProviderUrl}/simple/price?ids=${nativeCoinId}&vs_currencies=${currency}`:
            return Promise.resolve({ data: nativeCoinPriceProviderResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/usd`)
        .expect(200)
        .expect({
          fiatTotal: '4610.25',
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
              balance: '3000000000000000000',
              fiatBalance: '4610.25',
              fiatConversion: '1536.75',
            },
          ],
        });
    });

    it('returns large numbers as is (not in scientific notation)', async () => {
      const chain = chainBuilder().with('chainId', '1').build();
      const safeAddress = faker.finance.ethereumAddress();
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', tokenAddress)
          .with('balance', '40000000000000000000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(`chains.nativeCoins.${chain.chainId}`);
      const currency = 'eur';
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency]: 2.5 },
      };
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({ data: transactionApiBalancesResponse });
          case `${priceProviderUrl}/simple/token_price/${nativeCoinId}?contract_addresses=${tokenAddress}&vs_currencies=${currency}`:
            return Promise.resolve({ data: tokenPriceProviderResponse });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '1000000000000000000',
          items: [
            {
              tokenInfo: {
                type: 'ERC20',
                address: transactionApiBalancesResponse[0].tokenAddress,
                decimals: 17,
                symbol: transactionApiBalancesResponse[0].token?.symbol,
                name: transactionApiBalancesResponse[0].token?.name,
                logoUri: transactionApiBalancesResponse[0].token?.logoUri,
              },
              balance: '40000000000000000000000000000000000',
              fiatBalance: '1000000000000000000',
              fiatConversion: '2.5',
            },
          ],
        });

      // 3 Network calls are expected
      // (1. Chain data, 2. Balances, 3. Coingecko token)
      expect(networkService.get.mock.calls.length).toBe(3);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
      );
      expect(networkService.get.mock.calls[1][1]).toStrictEqual({
        params: { trusted: undefined, exclude_spam: undefined },
      });
      expect(networkService.get.mock.calls[2][0]).toBe(
        `${priceProviderUrl}/simple/token_price/${nativeCoinId}?contract_addresses=${tokenAddress}&vs_currencies=${currency}`,
      );
    });

    describe('Config API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        networkService.get.mockImplementation(() =>
          Promise.reject({ status: 500 }),
        );

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'An error occurred',
            code: 500,
          });

        expect(networkService.get.mock.calls.length).toBe(1);
      });
    });

    describe('Prices provider API Error', () => {
      it(`500 error response`, async () => {
        const chain = chainBuilder().with('chainId', '1').build();
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        const transactionApiBalancesResponse = [
          balanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const nativeCoinId = app
          .get(IConfigurationService)
          .getOrThrow(`chains.nativeCoins.${chain.chainId}`);
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({ data: transactionApiBalancesResponse });
            case `${priceProviderUrl}/simple/token_price/${nativeCoinId}?contract_addresses=${tokenAddress}&vs_currencies=${currency}`:
              return Promise.reject({ status: 429 });
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
            message: `Error getting ${tokenAddress} price from provider: 429`,
            code: 503,
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });

      it(`No price returned`, async () => {
        const chain = chainBuilder().with('chainId', '1').build();
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        const transactionApiBalancesResponse = [
          balanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const nativeCoinId = app
          .get(IConfigurationService)
          .getOrThrow(`chains.nativeCoins.${chain.chainId}`);
        const tokenPriceProviderResponse = {};
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({ data: transactionApiBalancesResponse });
            case `${priceProviderUrl}/simple/token_price/${nativeCoinId}?contract_addresses=${tokenAddress}&vs_currencies=${currency}`:
              return Promise.resolve({ data: tokenPriceProviderResponse });
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
              fiatTotal: '0',
              items: [
                {
                  tokenInfo: {
                    type: 'ERC20',
                    address: transactionApiBalancesResponse[0].tokenAddress,
                    decimals: 17,
                    symbol: transactionApiBalancesResponse[0].token?.symbol,
                    name: transactionApiBalancesResponse[0].token?.name,
                    logoUri: transactionApiBalancesResponse[0].token?.logoUri,
                  },
                  balance: '40000000000000000000000000000000000',
                  fiatBalance: null,
                  fiatConversion: null,
                },
              ],
            });
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });
    });

    describe('Transaction API Error', () => {
      it(`500 error response`, async () => {
        const chain = chainBuilder().build();
        const safeAddress = faker.finance.ethereumAddress();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.reject({ status: 500 });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'An error occurred',
            code: 500,
          });

        expect(networkService.get.mock.calls.length).toBe(2);
      });

      it(`500 error if validation fails`, async () => {
        const chain = chainBuilder().build();
        const safeAddress = faker.finance.ethereumAddress();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({ data: [{ invalid: 'data' }] });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'Validation failed',
            code: 42,
            arguments: [],
          });

        expect(networkService.get.mock.calls.length).toBe(2);
      });
    });
  });

  describe('GET /balances/supported-fiat-codes', () => {
    it('Success', async () => {
      const fiatCodes = exchangeFiatCodesBuilder()
        .with('success', true)
        .with('symbols', {
          AED: 'United Arab Emirates Dirham',
          USD: 'United States Dollar',
          AFN: 'Afghan Afghani',
          EUR: 'Euro',
          ALL: 'Albanian Lek',
        })
        .build();
      networkService.get.mockResolvedValueOnce({ data: fiatCodes });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(200)
        .expect(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    });

    it('Failure getting fiat currencies data', async () => {
      networkService.get.mockRejectedValueOnce(new Error());

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(503)
        .expect({
          code: 503,
          message: 'Error getting Fiat Codes from exchange',
        });
    });
  });
});
