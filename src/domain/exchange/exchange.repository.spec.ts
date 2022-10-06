import { IExchangeApi } from '../interfaces/exchange-api.interface';
import { ExchangeRepository } from './exchange.repository';
import exchangeFiatCodesFactory from './entities/__tests__/exchange-fiat-codes.factory';
import { ExchangeRatesValidator } from './exchange-rates.validator';
import { ExchangeFiatCodesValidator } from './exchange-fiat-codes.validator';
import exchangeRatesFactory from './entities/__tests__/exchange-rates.factory';

const mockExchangeApi = jest.mocked({
  getFiatCodes: jest.fn(),
  getRates: jest.fn(),
} as unknown as IExchangeApi);

const mockExchangeRatesValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as ExchangeRatesValidator);

const mockExchangeFiatCodesValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as ExchangeFiatCodesValidator);

describe('Exchange Repository', () => {
  let exchangeRepository: ExchangeRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    exchangeRepository = new ExchangeRepository(
      mockExchangeApi,
      mockExchangeRatesValidator,
      mockExchangeFiatCodesValidator,
    );
  });

  it('should return the Fiat Codes', async () => {
    const exchangeFiatCodes = exchangeFiatCodesFactory(true, {
      USD: 'dollar',
      AED: 'dirham',
    });
    mockExchangeApi.getFiatCodes.mockResolvedValue(exchangeFiatCodes);
    mockExchangeFiatCodesValidator.validate.mockReturnValueOnce(
      exchangeFiatCodes,
    );

    const result = await exchangeRepository.getFiatCodes();

    expect(Object.keys(exchangeFiatCodes.symbols)).toStrictEqual(result);
    expect(mockExchangeFiatCodesValidator.validate).toHaveBeenCalledTimes(1);
  });

  it('Should return convert rate', async () => {
    const ratesExchangeResult = exchangeRatesFactory(true, {
      BIG: 10,
      LIT: 1,
    });
    mockExchangeApi.getRates.mockResolvedValue(ratesExchangeResult);
    mockExchangeRatesValidator.validate.mockReturnValueOnce(
      ratesExchangeResult,
    );

    const result = await exchangeRepository.convertRates('LIT', 'BIG');

    expect(0.1).toBe(result);
  });

  it('ConvertRates should throw validation error', async () => {
    mockExchangeRatesValidator.validate.mockImplementation(() => {
      throw Error();
    });

    await expect(
      exchangeRepository.convertRates('LIT', 'BIG'),
    ).rejects.toThrow();
  });

  it('ConvertRates should throw exchange rate no available for "from"', async () => {
    const ratesExchangeResult = exchangeRatesFactory(true, {
      BIG: 10,
      LIT: 1,
    });
    mockExchangeApi.getRates.mockResolvedValue(ratesExchangeResult);
    mockExchangeRatesValidator.validate.mockReturnValueOnce(
      ratesExchangeResult,
    );

    await expect(
      exchangeRepository.convertRates('BIG', 'FROM'),
    ).rejects.toThrow('Exchange rate for FROM is not available');
  });

  it('ConvertRates should throw exchange rate no available for "to"', async () => {
    const ratesExchangeResult = exchangeRatesFactory(true, {
      BIG: 10,
      LIT: 1,
    });
    mockExchangeApi.getRates.mockResolvedValue(ratesExchangeResult);
    mockExchangeRatesValidator.validate.mockReturnValueOnce(
      ratesExchangeResult,
    );

    await expect(exchangeRepository.convertRates('TO', 'BIG')).rejects.toThrow(
      'Exchange rate for TO is not available',
    );
  });
});
