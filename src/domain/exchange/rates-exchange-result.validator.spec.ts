import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import ratesExchangeResultFactory from './entities/__tests__/rates-exchange-result.factory';
import { RatesExchangeResultValidator } from './rates-exchange-result.validator';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Rates Exchange Result validator', () => {
  const validator = new RatesExchangeResultValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const rates = ratesExchangeResultFactory();

    const result = validator.validate(rates);

    expect(result).toBe(rates);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
