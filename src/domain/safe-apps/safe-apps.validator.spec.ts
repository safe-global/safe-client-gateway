import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { SafeAppsValidator } from './safe-apps.validator';
import { safeAppSchema } from './entities/schemas/safe-app.schema';
import safeAppFactory from './entities/__tests__/safe-app.factory';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Safe Apps validator', () => {
  const validator = new SafeAppsValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(safeAppSchema);
  });

  it('should return the data when validation succeed', () => {
    const data = safeAppFactory();
    mockGenericValidator.validate.mockReturnValue(data);

    const result = validator.validate(data);

    expect(result).toEqual(data);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
