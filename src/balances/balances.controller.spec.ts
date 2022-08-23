import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import safeBalanceFactory from '../datasources/transaction-api/entities/__tests__/balance.factory';
import exchangeResultFactory from '../datasources/exchange-api/entities/__tests__/exchange.factory';
import chainFactory from '../datasources/config-api/entities/__tests__/chain.factory';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../common/network/__tests__/test.network.module';
import { BalancesModule } from './balances.module';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../common/config/__tests__/test.configuration.module';
import { FiatCodesExchangeResult } from '../datasources/exchange-api/entities/fiat-codes-result.entity';
import { TestCacheModule } from '../common/cache/__tests__/test.cache.module';

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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        BalancesModule,
        // common
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
    it(`Success`, async () => {
      const chainId = '1';
      const safeAddress = '0x0000000000000000000000000000000000000001';
      const transactionApiBalancesResponse = safeBalanceFactory(1);
      const exchangeApiResponse = exchangeResultFactory(true, { USD: 2.0 });
      const chainResponse = chainFactory(chainId);
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
        .get(`/chains/${chainId}/safes/${safeAddress}/balances/usd`)
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
                logoUri: expectedBalance?.token?.logo_uri,
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
        params: { trusted: undefined, excludeSpam: undefined },
      });
      expect(mockNetworkService.get.mock.calls[2][0]).toBe(
        'https://test.exchange/latest',
      );
    });

    describe('Exchange API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = safeBalanceFactory(1);
        const chainResponse = chainFactory(chainId);
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
          .get(`/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'Internal server error',
            statusCode: 500,
          });

        expect(mockNetworkService.get.mock.calls.length).toBe(3);
      });

      it(`No rates returned`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = safeBalanceFactory(1);
        const exchangeApiResponse = {}; // no rates
        const chainResponse = chainFactory(chainId);
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
          .get(`/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            statusCode: 500,
            message: 'Exchange rates unavailable',
            error: 'Internal Server Error',
          });

        expect(mockNetworkService.get.mock.calls.length).toBe(3);
      });

      it(`from-rate missing`, async () => {
        const chainId = '1';
        const safeAddress = '0x0000000000000000000000000000000000000001';
        const transactionApiBalancesResponse = safeBalanceFactory(1);
        const exchangeApiResponse = exchangeResultFactory(true, { XYZ: 2 }); // Returns different rate than USD
        const chainResponse = chainFactory(chainId);
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
          .get(`/chains/${chainId}/safes/${safeAddress}/balances/usd`)
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
        const transactionApiBalancesResponse = safeBalanceFactory(1);
        const exchangeApiResponse = exchangeResultFactory(true, { USD: 0 }); // rate is zero
        const chainResponse = chainFactory(chainId);
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
          .get(`/chains/${chainId}/safes/${safeAddress}/balances/usd`)
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
        const transactionApiBalancesResponse = safeBalanceFactory(1);
        const exchangeApiResponse = exchangeResultFactory(true, { USD: 2 }); // Returns different rate than XYZ
        const chainResponse = chainFactory(chainId);
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
          .get(`/chains/${chainId}/safes/${safeAddress}/balances/${toRate}`)
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
        const exchangeApiResponse = exchangeResultFactory(true, { USD: 2.0 });
        const chainResponse = chainFactory(chainId);
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
          .get(`/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(503)
          .expect({
            message: 'Service unavailable',
            code: 503,
          });

        expect(mockNetworkService.get.mock.calls.length).toBe(2);
      });
    });
  });

  describe('GET /balances/supported-fiat-codes', () => {
    it('Success', async () => {
      const fiatCodesResult: FiatCodesExchangeResult = {
        success: true,
        symbols: {
          AED: 'United Arab Emirates Dirham',
          USD: 'United States Dollar',
          AFN: 'Afghan Afghani',
          EUR: 'Euro',
          ALL: 'Albanian Lek',
        },
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: fiatCodesResult });

      await request(app.getHttpServer())
        .get('/balances/supported-fiat-codes')
        .expect(200)
        .expect(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    });

    it('Failure getting fiat currencies data', async () => {
      mockNetworkService.get.mockImplementationOnce(() => {
        throw new Error();
      });

      await request(app.getHttpServer())
        .get('/balances/supported-fiat-codes')
        .expect(500)
        .expect({
          message: 'Internal server error',
          statusCode: 500,
        });
    });
  });
});
