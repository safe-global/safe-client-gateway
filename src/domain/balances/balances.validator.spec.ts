import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { BalancesValidator } from './balances.validator';
import { balanceSchema } from './entities/schemas/balance.schema';
import { balanceBuilder } from './entities/__tests__/balance.builder';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Balances validator', () => {
  const validator = new BalancesValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(balanceSchema);
  });

  it('should return the data when validation succeed', () => {
    const balance = balanceBuilder().build();
    mockGenericValidator.validate.mockReturnValue(balance);

    const result = validator.validate(balance);

    expect(result).toEqual(balance);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
