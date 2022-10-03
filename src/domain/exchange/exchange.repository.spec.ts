import { IExchangeApi } from '../interfaces/exchange-api.interface';
import { ExchangeRepository } from './exchange.repository';
import exchangeFiatCodesFactory from './entities/__tests__/fiat-codes-exchange-result.factory';
import { RatesExchangeResultValidator } from './rates-exchange-result.validator';
import { FiatCodesExchangeResultValidator } from './fiat-codes-exchange-result.validator';

const mockExchangeApi = jest.mocked({
  getFiatCodes: jest.fn(),
  getExchangeResult: jest.fn(),
} as unknown as IExchangeApi);

const mockRatesExchangeResultValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as RatesExchangeResultValidator);

const mockFiatCodesExchangeResultValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as FiatCodesExchangeResultValidator);

describe('Exchange Repository', () => {
  let exchangeRepository: ExchangeRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    exchangeRepository = new ExchangeRepository(
      mockExchangeApi,
      mockRatesExchangeResultValidator,
      mockFiatCodesExchangeResultValidator,
    );
  });

  it('should return the Fiat Codes', async () => {
    const exchangeFiatCodes = exchangeFiatCodesFactory(true, {
      USD: 'dollar',
      AED: 'dirham',
    });
    mockExchangeApi.getFiatCodes.mockResolvedValue(exchangeFiatCodes);
    mockFiatCodesExchangeResultValidator.validate.mockReturnValueOnce(
      exchangeFiatCodes,
    );

    const result = await exchangeRepository.getFiatCodes();

    expect(Object.keys(exchangeFiatCodes.symbols)).toStrictEqual(result);
    expect(mockFiatCodesExchangeResultValidator.validate).toHaveBeenCalledTimes(
      1,
    );
  });

  // it('Should return convert rate', async () => {
  //   const exchangeResult = exchangeResultFactory(true, {
  //     BIG: 10,
  //     LIT: 1,
  //   });
  //   mockExchangeApi.getExchangeResult.mockResolvedValue(exchangeResult);
  //   validationFunction.mockImplementation(() => true);

  //   const result = await exchangeRepository.convertRates('LIT', 'BIG');

  //   expect(0.1).toBe(result);
  // });

  // it('ConvertRates should throw validation error', async () => {
  //   mockValidationErrorFactory.from.mockReturnValue(
  //     new HttpException('testErr', 500),
  //   );
  //   validationFunction.mockImplementationOnce(() => false);

  //   await expect(
  //     exchangeRepository.convertRates('LIT', 'BIG'),
  //   ).rejects.toThrow();
  // });

  // it('ConvertRates should throw exchange rate no available', async () => {
  //   const exchangeResult = exchangeResultFactory(true, {
  //     BIG: 10,
  //     LIT: 1,
  //   });
  //   mockExchangeApi.getExchangeResult.mockResolvedValue(exchangeResult);
  //   validationFunction.mockImplementation(() => true);

  //   await expect(exchangeRepository.convertRates('TO', 'BIG')).rejects.toThrow(
  //     'Exchange rate for TO is not available',
  //   );
  //   await expect(
  //     exchangeRepository.convertRates('BIG', 'FROM'),
  //   ).rejects.toThrow('Exchange rate for FROM is not available');
  // });
});
