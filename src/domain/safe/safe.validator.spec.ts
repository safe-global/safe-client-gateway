import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { SafeValidator } from './safe.validator';
import safeFactory from './entities/__tests__/safe.factory';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Safe validator', () => {
  const validator = new SafeValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const safe = safeFactory();
    mockGenericValidator.validate.mockReturnValue(safe);

    const result = validator.validate(safe);

    expect(result).toBe(safe);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
