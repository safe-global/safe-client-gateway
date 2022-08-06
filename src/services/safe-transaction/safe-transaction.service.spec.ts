import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { Balance } from './entities/balance.entity';
import { HttpErrorMapper } from '../errors/http-error-mapper';
import { SafeTransactionService } from './safe-transaction.service';

const BALANCES: Balance[] = [
  { tokenAddress: 'tokenAddress1', balance: 'balanceStr1' },
  { tokenAddress: 'tokenAddress2', balance: 'balanceStr2' },
];

const mockHttpService = {
  axiosRef: { get: jest.fn().mockResolvedValue({ data: BALANCES }) },
};

const mockHttpErrorMapper = {
  mapError: jest.fn(),
};

describe('SafeTransactionService', () => {
  let service: SafeTransactionService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafeTransactionService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        HttpErrorMapper,
      ],
    })
      .useMocker((token) => {
        switch (token) {
          case 'httpService':
            return mockHttpService;
          case 'baseUrl':
            return 'mockBaseUrl';
          case 'httpErrorMapper':
            return mockHttpErrorMapper;
        }
      })
      .compile();

    service = module.get<SafeTransactionService>(SafeTransactionService);
  });

  it('should return the data retrieved', async () => {
    const data = await service.getBalances('test', true, true);
    expect(data).toBe(BALANCES);
  });

  it('should call error mapper when an error happens', async () => {
    mockHttpService.axiosRef.get = jest.fn().mockImplementationOnce(() => {
      throw new Error();
    });

    await service.getBalances('test', true, true);
    expect(mockHttpErrorMapper.mapError).toHaveBeenCalledTimes(1);
  });
});
