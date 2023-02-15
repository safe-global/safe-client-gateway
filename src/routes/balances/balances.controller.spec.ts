import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { BalancesModule } from './balances.module';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { exchangeRatesBuilder } from '../../domain/exchange/entities/__tests__/exchange-rates.builder';
import { exchangeFiatCodesBuilder } from '../../domain/exchange/entities/__tests__/exchange-fiat-codes.builder';
import { balanceBuilder } from '../../domain/balances/entities/__tests__/balance.builder';
import { TestAppProvider } from '../../app.provider';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    fakeConfigurationService.set('exchange.baseUri', 'https://test.exchange');
    fakeConfigurationService.set('exchange.apiKey', 'testKey');
    fakeConfigurationService.set(
      'safeConfig.baseUri',
      'https://test.safe.config',
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        BalancesModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
    it(`Success`, async () => {
      const chainId = '1';
      const safeAddress = '0x0000000000000000000000000000000000000001';
      const transactionApiBalancesResponse = [balanceBuilder().build()];
      const exchangeApiResponse = exchangeRatesBuilder()
        .with('success', true)
        .with('rates', { USD: 2.0 })
        .build();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockImplementation((url) => {
        if (url == `https://test.safe.config/api/v1/chains/${chainId}`) {
          return Promise.resolve({ data: chainResponse });
        } else if (
          url ==
          `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
        ) {
          return Promise.resolve({
            data: transactionApiBalancesResponse,
          });
        } else if (url == 'https://test.exchange/latest') {
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
                tokenType: 'ERC20',
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
      expect(mockNetworkService.get.mock.calls.length).toBe(3);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/safes/0x0000000000000000000000000000000000000001/balances/usd/`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toStrictEqual({
        params: { trusted: undefined, exclude_spam: undefined },
      });
      expect(mockNetworkService.get.mock.calls[2][0]).toBe(
        'https://test.exchange/latest',
      );
    });

    describe('Config API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        mockNetworkService.get.mockImplementation(() =>
          Promise.reject({ status: 500 }),
        );

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'An error occurred',
            code: 500,
          });

        expect(mockNetworkService.get.mock.calls.length).toBe(1);
      });
    });

    describe('Exchange API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        mockNetworkService.get.mockImplementation((url) => {
          if (url == `https://test.safe.config/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (url == 'https://test.exchange/latest') {
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

        expect(mockNetworkService.get.mock.calls.length).toBe(3);
      });

      it(`No rates returned`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = [balanceBuilder().build()];
        const exchangeApiResponse = { success: true, base: 'USD' }; // no rates
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        mockNetworkService.get.mockImplementation((url) => {
          if (url == `https://test.safe.config/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (url == 'https://test.exchange/latest') {
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

        expect(mockNetworkService.get.mock.calls.length).toBe(3);
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
        mockNetworkService.get.mockImplementation((url) => {
          if (url == `https://test.safe.config/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (url == 'https://test.exchange/latest') {
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

        expect(mockNetworkService.get.mock.calls.length).toBe(3);
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
        mockNetworkService.get.mockImplementation((url) => {
          if (url == `https://test.safe.config/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (url == 'https://test.exchange/latest') {
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

        expect(mockNetworkService.get.mock.calls.length).toBe(3);
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
        mockNetworkService.get.mockImplementation((url) => {
          if (url == `https://test.safe.config/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
            });
          } else if (url == 'https://test.exchange/latest') {
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

        expect(mockNetworkService.get.mock.calls.length).toBe(3);
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
        mockNetworkService.get.mockImplementation((url) => {
          if (url == `https://test.safe.config/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.reject({ status: 500 });
          } else if (url == 'https://test.exchange') {
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

        expect(mockNetworkService.get.mock.calls.length).toBe(2);
      });

      it(`500 error if validation fails`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const exchangeApiResponse = exchangeRatesBuilder()
          .with('success', true)
          .with('rates', { USD: 2.0 })
          .build();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        mockNetworkService.get.mockImplementation((url) => {
          if (url == `https://test.safe.config/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/usd/`
          ) {
            return Promise.resolve({ data: [{ invalid: 'data' }] });
          } else if (url == 'https://test.exchange') {
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

        expect(mockNetworkService.get.mock.calls.length).toBe(2);
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
      mockNetworkService.get.mockResolvedValueOnce({ data: fiatCodes });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(200)
        .expect(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    });

    it('Failure getting fiat currencies data', async () => {
      mockNetworkService.get.mockRejectedValueOnce(new Error());

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
