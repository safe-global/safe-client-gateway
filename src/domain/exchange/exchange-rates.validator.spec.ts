import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { exchangeRatesSchema } from './entities/schemas/exchange-rates.schema';
import { ExchangeRatesValidator } from './exchange-rates.validator';
import { exchangeRatesBuilder } from './entities/__tests__/exchange-rates.builder';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Rates Exchange Result validator', () => {
  const validator = new ExchangeRatesValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(
      exchangeRatesSchema,
    );
  });

  it('should return the data when validation succeed', () => {
    const rates = exchangeRatesBuilder().build();
    mockGenericValidator.validate.mockReturnValue(rates);

    const result = validator.validate(rates);

    expect(result).toBe(rates);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
