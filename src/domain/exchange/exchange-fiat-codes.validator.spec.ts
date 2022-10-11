import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { exchangeFiatCodesSchema } from './entities/schemas/exchange-fiat-codes.schema';
import exchangeFiatCodesFactory from './entities/__tests__/exchange-fiat-codes.factory';
import { ExchangeFiatCodesValidator } from './exchange-fiat-codes.validator';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Fiat Codes Exchange Result validator', () => {
  const validator = new ExchangeFiatCodesValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(
      exchangeFiatCodesSchema,
    );
  });

  it('should return the data when validation succeed', () => {
    const fiatCodes = exchangeFiatCodesFactory();

    const result = validator.validate(fiatCodes);

    expect(result).toBe(fiatCodes);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
