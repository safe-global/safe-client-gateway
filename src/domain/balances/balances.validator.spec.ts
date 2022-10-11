import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { BalancesValidator } from './balances.validator';
import { balanceSchema } from './entities/schemas/balance.schema';
import { balanceFactory } from './entities/__tests__/balance.factory';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Balances validator', () => {
  const validator = new BalancesValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(
      balanceSchema,
    );
  });

  it('should return the data when validation succeed', () => {
    const balance = balanceFactory();
    const result = validator.validate(balance);

    expect(result).toEqual(balance);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
