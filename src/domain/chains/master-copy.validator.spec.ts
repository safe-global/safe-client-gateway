import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { masterCopySchema } from './entities/schemas/master-copy.schema';
import { MasterCopyValidator } from './master-copy.validator';
import { masterCopyBuilder } from './entities/__tests__/master-copy.builder';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
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
    const masterCopy = masterCopyBuilder().build();
    mockGenericValidator.validate.mockReturnValue(masterCopy);

    const result = validator.validate(masterCopy);

    expect(result).toEqual(masterCopy);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(
      masterCopySchema,
    );
  });
});
