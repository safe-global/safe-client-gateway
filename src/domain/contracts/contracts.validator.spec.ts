import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { ContractsValidator } from './contracts.validator';
import { contractSchema } from './entities/schemas/contract.schema';
import contractFactory from './entities/__tests__/contract.factory';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('Contracts validator', () => {
  const validator = new ContractsValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(contractSchema);
  });

  it('should return the data when validation succeed', () => {
    const contract = contractFactory();
    const result = validator.validate(contract);

    expect(result).toBe(contract);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
