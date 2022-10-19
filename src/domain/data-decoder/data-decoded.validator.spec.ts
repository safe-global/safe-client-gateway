import { GenericValidator } from '../schema/generic.validator';
import { JsonSchemaService } from '../schema/json-schema.service';
import { DataDecodedValidator } from './data-decoded.validator';
import dataDecodedFactory from './entities/__tests__/data-decoded.factory';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('DataDecoded validator', () => {
  const validator = new DataDecodedValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const dataDecoded = dataDecodedFactory();
    mockGenericValidator.validate.mockReturnValue(dataDecoded);

    const result = validator.validate(dataDecoded);

    expect(result).toBe(dataDecoded);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
