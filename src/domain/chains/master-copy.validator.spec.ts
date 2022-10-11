import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { masterCopySchema } from './entities/schemas/master-copy.schema';
import masterCopyFactory from './entities/__tests__/master-copy.factory';
import { MasterCopyValidator } from './master-copy.validator';

const mockGenericValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('MasterCopy validator', () => {
  const validator = new MasterCopyValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const masterCopy = masterCopyFactory();
    const result = validator.validate(masterCopy);

    expect(result).toEqual(masterCopy);
    expect(mockGenericValidator.execute).toHaveBeenCalledTimes(1);
  });

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(
      masterCopySchema,
    );
  });
});
