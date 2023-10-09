import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { balanceBuilder } from '@/domain/balances/entities/__tests__/balance.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { exchangeFiatCodesBuilder } from '@/domain/exchange/entities/__tests__/exchange-fiat-codes.builder';
import { exchangeRatesBuilder } from '@/domain/exchange/entities/__tests__/exchange-rates.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { faker } from '@faker-js/faker';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { AppModule, configurationModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { simpleBalanceBuilder } from '@/domain/balances/entities/__tests__/simple.balance.builder';
import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let exchangeUrl;
  let exchangeApiKey;
  let pricesProviderUrl;
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
    exchangeUrl = configurationService.get('exchange.baseUri');
    exchangeApiKey = configurationService.get('exchange.apiKey');
    pricesProviderUrl = configurationService.get('prices.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
    describe('GET /balances - using TX Service prices + Exchange Rates', () => {
      it(`maps ERC20 token correctly`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { USD: 2.0 })
          .build();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (
            url == `${exchangeUrl}/latest?access_key=${exchangeApiKey}`
          ) {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        const expectedBalance = transactionApiBalancesResponse[0];
        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(200)
          .expect({
            fiatTotal: expectedBalance.fiatBalance,
            items: [
              {
                tokenInfo: {
                  type: 'ERC20',
                  address: expectedBalance.tokenAddress,
                  decimals: expectedBalance.token?.decimals,
                  symbol: expectedBalance.token?.symbol,
                  name: expectedBalance.token?.name,
                  logoUri: expectedBalance?.token?.logoUri,
                },
                balance: expectedBalance.balance.toString(),
                fiatBalance: expectedBalance.fiatBalance,
                fiatConversion: expectedBalance.fiatConversion,
              },
            ],
          });

        // 3 Network calls are expected (1. Chain data, 2. Balances, 3. Exchange API
        expect(networkService.get.mock.calls.length).toBe(3);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${safeConfigUrl}/api/v1/chains/1`,
        );
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${chainResponse.transactionService}/api/v1/safes/0x0000000000000000000000000000000000000001/balances/usd/`,
        );
        expect(networkService.get.mock.calls[1][1]).toStrictEqual({
          params: { trusted: false, exclude_spam: true },
        });
        expect(networkService.get.mock.calls[2][0]).toBe(
          `${exchangeUrl}/latest?access_key=${exchangeApiKey}`,
        );
      });

      it(`excludeSpam and trusted params are forwarded to tx service`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const exchangeApiResponse = exchangeRatesBuilder().build();
        const chainResponse = chainBuilder().build();
        const excludeSpam = true;
        const trusted = true;

        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (
            url == `${exchangeUrl}/latest?access_key=${exchangeApiKey}`
          ) {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chainId}/safes/${safeAddress}/balances/usd/?trusted=${trusted}&exclude_spam=${excludeSpam}`,
          )
          .expect(200);

        // trusted and exclude_spam params are passed
        expect(networkService.get.mock.calls[1][1]).toStrictEqual({
          params: {
            trusted,
            exclude_spam: excludeSpam,
          },
        });
      });

      it(`maps native token correctly`, async () => {
        const safeAddress = faker.finance.ethereumAddress();
        const transactionApiBalancesResponse = [
          balanceBuilder().with('tokenAddress', null).build(),
        ];
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { USD: 2.0 })
          .build();
        const chain = chainBuilder().build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: chain });
          } else if (
            url ==
            `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (
            url == `${exchangeUrl}/latest?access_key=${exchangeApiKey}`
          ) {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        const expectedBalance = transactionApiBalancesResponse[0];
        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/usd`)
          .expect(200)
          .expect({
            fiatTotal: expectedBalance.fiatBalance,
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
                balance: expectedBalance.balance.toString(),
                fiatBalance: expectedBalance.fiatBalance,
                fiatConversion: expectedBalance.fiatConversion,
              },
            ],
          });
      });

      it('returns large numbers as is (not in scientific notation)', async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [
          balanceBuilder()
            .with('balance', '266279793958307969327868')
            // The Transaction Service can return scientific notation for large numbers
            .with('fiatBalance', '6.25164198388829e+43')
            .with('fiatConversion', '2.347771827128244e+38')
            .build(),
        ];
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { USD: 1.0 })
          .build();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (
            url == `${exchangeUrl}/latest?access_key=${exchangeApiKey}`
          ) {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        const expectedFiatBalance =
          '62516419838882900000000000000000000000000000';
        const expectedFiatConversion =
          '234777182712824400000000000000000000000';
        const expectedBalance = transactionApiBalancesResponse[0];

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(200)
          .expect({
            fiatTotal: expectedFiatBalance,
            items: [
              {
                tokenInfo: {
                  type: 'ERC20',
                  address: expectedBalance.tokenAddress,
                  decimals: expectedBalance.token?.decimals,
                  symbol: expectedBalance.token?.symbol,
                  name: expectedBalance.token?.name,
                  logoUri: expectedBalance?.token?.logoUri,
                },
                balance: expectedBalance.balance,
                fiatBalance: expectedFiatBalance,
                fiatConversion: expectedFiatConversion,
              },
            ],
          });

        // 3 Network calls are expected (1. Chain data, 2. Balances, 3. Exchange API
        expect(networkService.get.mock.calls.length).toBe(3);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${safeConfigUrl}/api/v1/chains/1`,
        );
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${chainResponse.transactionService}/api/v1/safes/0x0000000000000000000000000000000000000001/balances/usd/`,
        );
        expect(networkService.get.mock.calls[1][1]).toStrictEqual({
          params: { trusted: false, exclude_spam: true },
        });
        expect(networkService.get.mock.calls[2][0]).toBe(
          `${exchangeUrl}/latest?access_key=${exchangeApiKey}`,
        );
      });
    });

    describe('GET /balances - using TX Service balances + Prices provider', () => {
      it(`maps native coin + ERC20 token balance correctly, and sorts balances by fiatBalance`, async () => {
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const transactionApiBalancesResponse = [
          simpleBalanceBuilder()
            .with('tokenAddress', null)
            .with('balance', '3000000000000000000')
            .with('token', null)
            .build(),
          simpleBalanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '4000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const nativeCoinId = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.nativeCoin`);
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
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
            case `${pricesProviderUrl}/simple/price`:
              return Promise.resolve({ data: nativeCoinPriceProviderResponse });
            case `${pricesProviderUrl}/simple/token_price/${chainName}`:
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
            ],
          });

        // 4 Network calls are expected
        // (1. Chain data, 2. Balances, 3. Coingecko native coin, 4. Coingecko token)
        expect(networkService.get.mock.calls.length).toBe(4);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
        );
        expect(networkService.get.mock.calls[1][1]).toStrictEqual({
          params: { trusted: false, exclude_spam: true },
        });
        expect(networkService.get.mock.calls[2][0]).toBe(
          `${pricesProviderUrl}/simple/price`,
        );
        expect(networkService.get.mock.calls[3][0]).toBe(
          `${pricesProviderUrl}/simple/token_price/${chainName}`,
        );
      });

      it(`excludeSpam and trusted params are forwarded to tx service`, async () => {
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const transactionApiBalancesResponse = [
          simpleBalanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '4000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const excludeSpam = true;
        const trusted = true;
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
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
            case `${pricesProviderUrl}/simple/token_price/${chainName}`:
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
            trusted,
            exclude_spam: excludeSpam,
          },
        });
      });

      it(`maps native token correctly`, async () => {
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = faker.finance.ethereumAddress();
        const transactionApiBalancesResponse = [
          simpleBalanceBuilder()
            .with('tokenAddress', null)
            .with('balance', '3000000000000000000')
            .with('token', null)
            .build(),
        ];
        const currency = 'usd';
        const nativeCoinId = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.nativeCoin`);
        const nativeCoinPriceProviderResponse = {
          [nativeCoinId]: { [currency]: 1536.75 },
        };
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({ data: transactionApiBalancesResponse });
            case `${pricesProviderUrl}/simple/price`:
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
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const transactionApiBalancesResponse = [
          simpleBalanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
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
            case `${pricesProviderUrl}/simple/token_price/${chainName}`:
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
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
        );
        expect(networkService.get.mock.calls[1][1]).toStrictEqual({
          params: { trusted: false, exclude_spam: true },
        });
        expect(networkService.get.mock.calls[2][0]).toBe(
          `${pricesProviderUrl}/simple/token_price/${chainName}`,
        );
      });
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
      it(`should return a 0-balance when an error is thrown by the provider`, async () => {
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        const transactionApiBalancesResponse = [
          simpleBalanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({ data: transactionApiBalancesResponse });
            case `${pricesProviderUrl}/simple/token_price/${chainName}`:
              return Promise.reject();
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
                fiatBalance: '0',
                fiatConversion: '0',
              },
            ],
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });

      it(`should return a 0-balance when a validation error happens`, async () => {
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        const transactionApiBalancesResponse = [
          simpleBalanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
        const tokenPriceProviderResponse = 'notAnObject';
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({ data: transactionApiBalancesResponse });
            case `${pricesProviderUrl}/simple/token_price/${chainName}`:
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
                fiatBalance: '0',
                fiatConversion: '0',
              },
            ],
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });
    });

    describe('Exchange API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (url == `${exchangeUrl}/latest`) {
            return Promise.reject({ status: 500 });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(503)
          .expect({
            message: 'Error getting exchange data',
            code: 503,
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });

      it(`No rates returned`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const exchangeApiResponse = { success: true, base: 'USD' }; // no rates
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (
            url == `${exchangeUrl}/latest?access_key=${exchangeApiKey}`
          ) {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'Validation failed',
            code: 42,
            arguments: [],
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });

      it(`from-rate missing`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { XYZ: 2 })
          .build(); // Returns different rate than USD
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (
            url == `${exchangeUrl}/latest?access_key=${exchangeApiKey}`
          ) {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            statusCode: 500,
            message: 'Exchange rate for USD is not available',
            error: 'Internal Server Error',
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });

      it(`from-rate is 0`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { USD: 0 }) // rate is zero
          .build();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (
            url == `${exchangeUrl}/latest?access_key=${exchangeApiKey}`
          ) {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            statusCode: 500,
            message: 'Exchange rate for USD is not available',
            error: 'Internal Server Error',
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });

      it(`to-rate missing`, async () => {
        const chainId = '1';
        const toRate = 'XYZ';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { USD: 2 }) // Returns different rate than XYZ
          .build();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (
            url == `${exchangeUrl}/latest?access_key=${exchangeApiKey}`
          ) {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/${toRate}`)
          .expect(500)
          .expect({
            statusCode: 500,
            message: 'Exchange rate for XYZ is not available',
            error: 'Internal Server Error',
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });
    });

    describe('Transaction API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { USD: 2.0 })
          .build();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.reject({ status: 500 });
          } else if (url == '${exchangeUrl}') {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
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

        expect(networkService.get.mock.calls.length).toBe(2);
      });

      it(`500 error if validation fails`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { USD: 2.0 })
          .build();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({ data: [{ invalid: 'data' }] });
          } else if (url == '${exchangeUrl}') {
            return Promise.resolve({ data: exchangeApiResponse });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
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
    it('should return the ordered list of supported fiat codes', async () => {
      const exchangeFiatCodes = exchangeFiatCodesBuilder()
        .with('success', true)
        .with('symbols', {
          GBP: 'British Pound Sterling',
          USD: 'United States Dollar',
          AFN: 'Afghan Afghani',
          EUR: 'Euro',
          ALL: 'Albanian Lek',
        })
        .build();
      const pricesProviderFiatCodes = ['chf', 'gbp', 'eur', 'eth', 'afn'];
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${exchangeUrl}/symbols?access_key=${exchangeApiKey}`:
            return Promise.resolve({ data: exchangeFiatCodes });
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({ data: pricesProviderFiatCodes });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(200)
        .expect(['USD', 'EUR', 'AFN', 'GBP']);
    });

    it('should fail getting fiat currencies data from exchange', async () => {
      const pricesProviderFiatCodes = ['chf', 'gbp', 'eur', 'eth', 'afn'];
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${exchangeUrl}/symbols?access_key=${exchangeApiKey}`:
            return Promise.reject(new Error());
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({ data: pricesProviderFiatCodes });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(503)
        .expect({
          code: 503,
          message: 'Error getting Fiat Codes from exchange',
        });
    });

    it('should fail getting fiat currencies data from prices provider', async () => {
      const exchangeFiatCodes = exchangeFiatCodesBuilder().build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${exchangeUrl}/symbols?access_key=${exchangeApiKey}`:
            return Promise.resolve({ data: exchangeFiatCodes });
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.reject(new Error());
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(503)
        .expect({
          code: 503,
          message: 'Error getting Fiat Codes from prices provider',
        });
    });

    it('validation error getting fiat currencies data from prices provider', async () => {
      const pricesProviderFiatCodes = [];
      const exchangeFiatCodes = exchangeFiatCodesBuilder().build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${exchangeUrl}/symbols?access_key=${exchangeApiKey}`:
            return Promise.resolve({ data: exchangeFiatCodes });
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({ data: pricesProviderFiatCodes });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });

    it('validation error (2) getting fiat currencies data from prices provider', async () => {
      const pricesProviderFiatCodes = 'notAnArray';
      const exchangeFiatCodes = exchangeFiatCodesBuilder().build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${exchangeUrl}/symbols?access_key=${exchangeApiKey}`:
            return Promise.resolve({ data: exchangeFiatCodes });
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({ data: pricesProviderFiatCodes });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });
});
