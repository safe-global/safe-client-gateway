import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { IExchangeApi } from '../interfaces/exchange-api.interface';
import { ExchangeRepository } from './exchange.repository';
import { ExchangeApi } from '../../datasources/exchange-api/exchange-api.service';
import exchangeResultFactory from '../../domain/exchange/entities/__tests__/exchange.factory';
import exchangeFiatCodesFactory from '../../domain/exchange/entities/__tests__/fiat-codes.factory';

const validationErrorFactory = {
  from: jest.fn().mockReturnValue(new HttpException('testErr', 500)),
} as unknown as ValidationErrorFactory;

const validationFunction = jest.fn();
validationFunction.mockImplementation(() => true);

const jsonSchemaService = {
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService;

const exchangeApi = {
  getFiatCodes: jest.fn().mockResolvedValue(ExchangeApi),
  getExchangeResult: jest.fn().mockResolvedValue(ExchangeApi),
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

    const result = await exchangeRepository.getFiatCodes();
    expect(Object.keys(exchangeFiatCodes.symbols)).toStrictEqual(result);
  });

  it('Should return convert rate', async () => {
    const exchangeResult = exchangeResultFactory(true, {
      BIG: 10,
      LIT: 1,
    });
    mockExchangeApi.getExchangeResult.mockResolvedValue(exchangeResult);

    const result = await exchangeRepository.convertRates('LIT', 'BIG');
    expect(0.1).toBe(result);
  });
});
