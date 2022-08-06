import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Balance } from './entities/balance.entity';
import { HttpErrorMapper } from '../errors/http-error-mapper';
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
  let httpErrorMapper: HttpErrorMapper;

  beforeEach(async () => {
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
            return new HttpErrorMapper();
        }
      })
      .compile();

    service = module.get<SafeTransactionService>(SafeTransactionService);
    httpService = module.get<HttpService>(HttpService);
    httpErrorMapper = module.get<HttpErrorMapper>(HttpErrorMapper);
  });

  it('should return the data retrieved', async () => {
    const data = await service.getBalances('test', true, true);
    expect(data).toBe(BALANCES);
  });

  it('should throw an HttpException when an http error is catch', async () => {
    const errMessage = 'testMessage';
    const errStatusCode = 400;

    mockHttpService.axiosRef.get = jest.fn().mockImplementationOnce(() => {
      throw new AxiosError(
        'Request failed with status code 400',
        'ERR_BAD_REQUEST',
        null,
        null,
        <AxiosResponse>{ data: { message: errMessage }, status: errStatusCode },
      );
    });

    try {
      await service.getBalances('test', true, true);
    } catch (err) {
      expect(err.message).toBe(errMessage);
      expect(err.status).toBe(errStatusCode);
    }
  });

  it('should throw an HttpException when no response is received', async () => {
    const errMessage = 'Service unavailable';
    const errStatusCode = 503;

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
      expect(err.message).toBe(errMessage);
      expect(err.status).toBe(errStatusCode);
    }
  });

  it('should throw an HttpException when an arbitrary error happens while doing the request', async () => {
    const errMessage = 'Service unavailable';
    const errStatusCode = 503;

    mockHttpService.axiosRef.get = jest.fn().mockImplementationOnce(() => {
      throw new Error('Random error');
    });

    try {
      await service.getBalances('test', true, true);
    } catch (err) {
      expect(err.message).toBe(errMessage);
      expect(err.status).toBe(errStatusCode);
    }
  });
});
