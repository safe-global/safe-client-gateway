import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import fiatCodesExchangeResultFactory from './entities/__tests__/fiat-codes-exchange-result.factory';
import { FiatCodesExchangeResultValidator } from './fiat-codes-exchange-result.validator';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Fiat Codes Exchange Result validator', () => {
  const validator = new FiatCodesExchangeResultValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const fiatCodes = fiatCodesExchangeResultFactory();

    const result = validator.validate(fiatCodes);

    expect(result).toBe(fiatCodes);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
