import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { Balance } from './entities/balance.entity';
import { SafeTransactionService } from './safe-transaction.service';

const BALANCES: Balance[] = [
  { tokenAddress: 'tokenAddress1', balance: 'balanceStr1' },
  { tokenAddress: 'tokenAddress2', balance: 'balanceStr2' },
  { tokenAddress: 'tokenAddress3', balance: 'balanceStr3' },
];

const mockHttpService = {
  axiosRef: { get: jest.fn().mockResolvedValue({ data: BALANCES }) },
};

describe('SafeTransactionService', () => {
  let service: SafeTransactionService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafeTransactionService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    })
      .useMocker((token) => {
        switch (token) {
          case 'httpService':
            return mockHttpService;
          case 'baseUrl':
            return 'mockBaseUrl';
        }
      })
      .compile();

    service = module.get<SafeTransactionService>(SafeTransactionService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should return the data retrieved', async () => {
    const data = await service.getBalances('test', true, true);
    expect(data).toBe(BALANCES);
  });

  it('should throw an HttpException when an http error is catch', async () => {
    mockHttpService.axiosRef.get = jest.fn().mockResolvedValue({ data: 'foo' });
    const data = await service.getBalances('test', true, true);
    expect(data).toBe('foo');
  });
});
