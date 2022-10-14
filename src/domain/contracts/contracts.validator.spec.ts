import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { ContractsValidator } from './contracts.validator';
import { contractSchema } from './entities/schemas/contract.schema';
import contractFactory from './entities/__tests__/contract.factory';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('Contracts validator', () => {
  const validator = new ContractsValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(contractSchema);
  });

  it('should return the data when validation succeed', () => {
    const contract = contractFactory();
    mockGenericValidator.validate.mockReturnValue(contract);

    const result = validator.validate(contract);

    expect(result).toBe(contract);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
