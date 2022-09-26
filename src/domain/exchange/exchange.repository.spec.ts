import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { IExchangeApi } from '../interfaces/exchange-api.interface';
import { ExchangeRepository } from './exchange.repository';
import exchangeResultFactory from '../../domain/exchange/entities/__tests__/exchange.factory';
import exchangeFiatCodesFactory from '../../domain/exchange/entities/__tests__/fiat-codes.factory';

const validationErrorFactory = {
  from: jest.fn(),
} as unknown as ValidationErrorFactory;

const validationFunction = jest.fn();

const jsonSchemaService = {
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService;

const exchangeApi = {
  getFiatCodes: jest.fn(),
  getExchangeResult: jest.fn(),
} as unknown as IExchangeApi;

const mockExchangeApi = jest.mocked(exchangeApi);
const mockValidationErrorFactory = jest.mocked(validationErrorFactory);
const mockJsonSchemaService = jest.mocked(jsonSchemaService);

describe('Exchange Repository', () => {
  let exchangeRepository: ExchangeRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    exchangeRepository = new ExchangeRepository(
      mockExchangeApi,
      mockValidationErrorFactory,
      mockJsonSchemaService,
    );
  });

  it('should return the Fiat Codes', async () => {
    const exchangeFiatCodes = exchangeFiatCodesFactory(true, {
      USD: 'dollar',
      AED: 'dirham',
    });
    mockExchangeApi.getFiatCodes.mockResolvedValue(exchangeFiatCodes);
    validationFunction.mockImplementation(() => true);

    const result = await exchangeRepository.getFiatCodes();

    expect(Object.keys(exchangeFiatCodes.symbols)).toStrictEqual(result);
  });

  it('getFiatCodes should throw validation error', async () => {
    mockValidationErrorFactory.from.mockReturnValue(
      new HttpException('testErr', 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    await expect(exchangeRepository.getFiatCodes()).rejects.toThrow();
  });

  it('Should return convert rate', async () => {
    const exchangeResult = exchangeResultFactory(true, {
      BIG: 10,
      LIT: 1,
    });
    mockExchangeApi.getExchangeResult.mockResolvedValue(exchangeResult);
    validationFunction.mockImplementation(() => true);

    const result = await exchangeRepository.convertRates('LIT', 'BIG');

    expect(0.1).toBe(result);
  });

  it('ConvertRates should throw validation error', async () => {
    mockValidationErrorFactory.from.mockReturnValue(
      new HttpException('testErr', 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    await expect(
      exchangeRepository.convertRates('LIT', 'BIG'),
    ).rejects.toThrow();
  });

  it('ConvertRates should throw exchange rate no available', async () => {
    const exchangeResult = exchangeResultFactory(true, {
      BIG: 10,
      LIT: 1,
    });
    mockExchangeApi.getExchangeResult.mockResolvedValue(exchangeResult);
    validationFunction.mockImplementation(() => true);

    await expect(exchangeRepository.convertRates('TO', 'BIG')).rejects.toThrow(
      'Exchange rate for TO is not available',
    );
    await expect(
      exchangeRepository.convertRates('BIG', 'FROM'),
    ).rejects.toThrow('Exchange rate for FROM is not available');
  });
});
