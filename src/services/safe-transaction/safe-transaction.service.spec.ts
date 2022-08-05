import { HttpService } from '@nestjs/axios';
import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
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
    mockHttpService.axiosRef.get = jest.fn().mockImplementationOnce(() => {
      throw new AxiosError(
        'Request failed with status code 400',
        'ERR_BAD_REQUEST',
        null,
        null,
        <AxiosResponse>{ data: { message: 'testMessage' }, status: 400 },
      );
    });
    await expect(service.getBalances('test', true, true)).rejects.toEqual(
      new HttpException('testMessage', 400),
    );
  });

  it('should throw an HttpException when no response is received', async () => {
    mockHttpService.axiosRef.get = jest.fn().mockImplementationOnce(() => {
      throw new AxiosError(
        'Request failed with status code 500',
        'ERR_BAD_RESPONSE',
        null,
        <AxiosRequestConfig>{ url: 'testUrl', method: 'GET' },
        null,
      );
    });

    try {
      await service.getBalances('test', true, true);
    } catch (err) {
      expect(err.message).toBe('Service unavailable');
      expect(err.status).toBe(503);
    }
  });

  it('should throw an HttpException when an arbitrary error happens while doing the request', async () => {
    mockHttpService.axiosRef.get = jest.fn().mockImplementationOnce(() => {
      throw new Error('Random error');
    });

    try {
      await service.getBalances('test', true, true);
    } catch (err) {
      expect(err.message).toBe('Service unavailable');
      expect(err.status).toBe(503);
    }
  });
});
