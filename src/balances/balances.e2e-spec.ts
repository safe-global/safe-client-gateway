import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';
import {
  safeTransactionManagerMock,
  safeTransactionServiceMock,
  TestSafeTransactionModule,
} from '../services/safe-transaction/safe-transaction.module.spec';
import { Balance } from '../services/safe-transaction/entities/balance.entity';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();
    // TODO Once this PR is merged and released we can use [BalancesModule] directly – https://github.com/nestjs/nest/pull/8777
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BalancesController],
      providers: [BalancesService],
      imports: [TestSafeTransactionModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it(`GET /balances`, async () => {
    const chainId = 1;
    const safeAddress = '0x0000000';
    const safeTransactionServiceBalances: Balance[] = [
      <Balance>{ tokenAddress: '0x000000', balance: '1' },
    ];
    safeTransactionManagerMock.getTransactionService.mockResolvedValue(
      safeTransactionServiceMock,
    );
    safeTransactionServiceMock.getBalances.mockResolvedValue(
      safeTransactionServiceBalances,
    );

    await request(app.getHttpServer())
      .get(`/chains/${chainId}/safes/${safeAddress}/balances`)
      .expect(200)
      .expect([{ tokenAddress: '0x000000', balance: '1' }]);

    expect(safeTransactionManagerMock.getTransactionService).toBeCalledTimes(1);
    expect(safeTransactionServiceMock.getBalances).toBeCalledTimes(1);
  });

  afterAll(async () => {
    await app.close();
  });
});
