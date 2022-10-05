import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import masterCopyFactory from './entities/__tests__/master-copy.factory';
import { MasterCopyValidator } from './master-copy.validator';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('MasterCopy validator', () => {
  const validator = new MasterCopyValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const masterCopy = masterCopyFactory();
    const result = validator.validate(masterCopy);

    expect(result).toEqual(masterCopy);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
