import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import axios from 'axios';
import { BalancesModule } from './balances.module';

jest.mock('axios');
const axiosMock = axios as jest.Mocked<typeof axios>;

describe('AppController (e2e)', () => {
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
    const safeAddress = '0x0000000';
    const safeTransactionServiceBalancesResponse = {
      data: [{ tokenAddress: '0x000000', balance: '1' }],
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
        `https://test.safe.transaction.service/api/v1/safes/${safeAddress}/balances/usd/`
      ) {
        return Promise.resolve(safeTransactionServiceBalancesResponse);
      } else {
        return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(`/chains/${chainId}/safes/${safeAddress}/balances`)
      .expect(200)
      .expect([{ tokenAddress: '0x000000', balance: '1' }]);

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
