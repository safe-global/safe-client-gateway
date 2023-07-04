import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../__tests__/test-app.provider';
import { TestCacheModule } from '../../datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '../../datasources/network/__tests__/test.network.module';
import { balanceBuilder } from '../../domain/balances/entities/__tests__/balance.builder';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { exchangeFiatCodesBuilder } from '../../domain/exchange/entities/__tests__/exchange-fiat-codes.builder';
import { exchangeRatesBuilder } from '../../domain/exchange/entities/__tests__/exchange-rates.builder';
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

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;
  let exchangeUrl;
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
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
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
        } else if (url == `${exchangeUrl}/latest`) {
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
        params: { trusted: undefined, exclude_spam: undefined },
      });
      expect(networkService.get.mock.calls[2][0]).toBe(`${exchangeUrl}/latest`);
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
        } else if (url == `${exchangeUrl}/latest`) {
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
          trusted: trusted.toString(),
          exclude_spam: excludeSpam.toString(),
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
        } else if (url == `${exchangeUrl}/latest`) {
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
          } else if (url == `${exchangeUrl}/latest`) {
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
          } else if (url == `${exchangeUrl}/latest`) {
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
          } else if (url == `${exchangeUrl}/latest`) {
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
          } else if (url == `${exchangeUrl}/latest`) {
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
