import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { exchangeRatesSchema } from './entities/schemas/exchange-rates.schema';
import exchangeRatesFactory from './entities/__tests__/exchange-rates.factory';
import { ExchangeRatesValidator } from './exchange-rates.validator';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Rates Exchange Result validator', () => {
  const validator = new ExchangeRatesValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(
      exchangeRatesSchema,
    );
  });

  it('should return the data when validation succeed', () => {
    const rates = exchangeRatesFactory();

    const result = validator.validate(rates);

    expect(result).toBe(rates);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
