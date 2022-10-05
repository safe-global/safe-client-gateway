import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { SafeValidator } from './safe.validator';
import safeFactory from './entities/__tests__/safe.factory';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Safe validator', () => {
  const validator = new SafeValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const safe = safeFactory();

    const result = validator.validate(safe);

    expect(result).toBe(safe);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
