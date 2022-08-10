import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import axios from 'axios';
import { BalancesModule } from './balances.module';

jest.mock('axios');
const axiosMock = axios as jest.Mocked<typeof axios>;

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [BalancesModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it(`GET /balances`, async () => {
    const chainId = 1;
    const safeAddress = '0x0000000000000000000000000000000000000001';
    const safeTransactionServiceBalancesResponse = {
      data: [
        {
          tokenAddress: `0x6810e776880C02933D47DB1b9fc05908e5386b96`,
          token: {
            name: 'Gnosis',
            symbol: 'GNO',
            decimals: 16,
            logo_uri: null,
          },
          balance: 1,
          fiatBalance: 100,
          fiatConversion: 2,
        },
      ],
    };

    const exchangeResponse = {
      data: {
        success: true,
        timestamp: 1660567445,
        base: 'EUR',
        date: '2022-08-15',
        rates: {
          USD: 2,
        },
      },
    };

    const safeConfigServiceResponse = {
      data: {
        chainId: '1',
        chainName: 'mainnet',
        transactionService: 'https://test.safe.transaction.service',
        vpcTransactionService: 'https://test.safe.transaction.service',
      },
    };
    axiosMock.get.mockImplementation((url) => {
      if (url == 'https://safe-config.gnosis.io/api/v1/chains/1') {
        return Promise.resolve(safeConfigServiceResponse);
      } else if (
        url ==
        `https://test.safe.transaction.service/api/v1/safes/0x0000000000000000000000000000000000000001/balances/usd/`
      ) {
        return Promise.resolve(safeTransactionServiceBalancesResponse);
      } else if (url == 'http://api.exchangeratesapi.io/latest') {
        return Promise.resolve(exchangeResponse);
      } else {
        return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(`/chains/${chainId}/safes/${safeAddress}/balances/USD`)
      .expect(200)
      .expect({
        fiatTotal: 100,
        items: [
          {
            tokenInfo: {
              tokenType: 'ERC20',
              address: '0x6810e776880C02933D47DB1b9fc05908e5386b96',
              decimals: 16,
              symbol: 'GNO',
              name: 'Gnosis',
              logoUri: null,
            },
            balance: 1,
            fiatBalance: 100,
            fiatConversion: 2,
          },
        ],
      });

    expect(axiosMock.get.mock.calls[0][0]).toBe(
      'https://safe-config.gnosis.io/api/v1/chains/1',
    );
    expect(axiosMock.get.mock.calls[1][0]).toBe(
      `https://test.safe.transaction.service/api/v1/safes/${safeAddress}/balances/usd/`,
    );
    expect(axiosMock.get.mock.calls[1][1]).toStrictEqual({
      params: { trusted: undefined, excludeSpam: undefined },
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
